/**
 * Image Builder - генерация XML для изображений
 */

const fs = require('fs');
const path = require('path');
const { paragraph } = require('../utils/xml-utils');

// Попробуем загрузить image-size, если не получится - используем fallback
let sizeOf;
try {
  sizeOf = require('image-size');
} catch (e) {
  sizeOf = null;
}

/**
 * Получение размеров изображения
 * @param {string} imagePath - Путь к изображению
 * @returns {Object} {width, height} в пикселях
 */
function getImageDimensions(imagePath) {
  if (sizeOf) {
    try {
      const dimensions = sizeOf(imagePath);
      return { width: dimensions.width, height: dimensions.height };
    } catch (e) {
      // Fallback размеры
      return { width: 400, height: 300 };
    }
  }
  // Если библиотека не установлена - default размеры
  return { width: 400, height: 300 };
}

/**
 * Конвертация пикселей в EMU (English Metric Units)
 * 1 дюйм = 914400 EMU, 1 пиксель ≈ 9525 EMU при 96 DPI
 * @param {number} pixels - Размер в пикселях
 * @returns {number} Размер в EMU
 */
function pixelsToEmu(pixels) {
  return Math.round(pixels * 9525);
}

/**
 * Парсинг атрибута размера из Markdown
 * @param {string} widthAttr - Атрибут ширины (например, "70%" или "400px")
 * @param {number} originalWidth - Оригинальная ширина
 * @param {number} maxWidth - Максимальная ширина (ширина страницы)
 * @returns {number} Ширина в пикселях
 */
function parseWidthAttribute(widthAttr, originalWidth, maxWidth = 600) {
  if (!widthAttr) return Math.min(originalWidth, maxWidth);
  
  if (widthAttr.endsWith('%')) {
    const percent = parseInt(widthAttr, 10);
    return Math.round((maxWidth * percent) / 100);
  }
  
  if (widthAttr.endsWith('px')) {
    return parseInt(widthAttr, 10);
  }
  
  // Просто число - считаем пикселями
  const num = parseInt(widthAttr, 10);
  if (!isNaN(num)) return num;
  
  return Math.min(originalWidth, maxWidth);
}

/**
 * Генерация XML для изображения
 * @param {Object} imageData - Данные изображения
 * @param {string} imageData.rId - Relationship ID
 * @param {string} imageData.name - Имя изображения
 * @param {number} imageData.width - Ширина в EMU
 * @param {number} imageData.height - Высота в EMU
 * @param {string} imageData.alt - Alt текст
 * @param {number} imageData.docPrId - ID для docPr
 * @returns {string} XML строка <w:drawing>
 */
function buildImageXml(imageData) {
  const { rId, name, width, height, alt, docPrId } = imageData;
  
  return `<w:drawing>
  <wp:inline distT="0" distB="0" distL="0" distR="0">
    <wp:extent cx="${width}" cy="${height}"/>
    <wp:effectExtent l="0" t="0" r="0" b="0"/>
    <wp:docPr id="${docPrId}" name="${name}" descr="${alt || name}"/>
    <wp:cNvGraphicFramePr>
      <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
    </wp:cNvGraphicFramePr>
    <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
        <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:nvPicPr>
            <pic:cNvPr id="${docPrId}" name="${name}"/>
            <pic:cNvPicPr/>
          </pic:nvPicPr>
          <pic:blipFill>
            <a:blip r:embed="${rId}"/>
            <a:stretch>
              <a:fillRect/>
            </a:stretch>
          </pic:blipFill>
          <pic:spPr>
            <a:xfrm>
              <a:off x="0" y="0"/>
              <a:ext cx="${width}" cy="${height}"/>
            </a:xfrm>
            <a:prstGeom prst="rect">
              <a:avLst/>
            </a:prstGeom>
          </pic:spPr>
        </pic:pic>
      </a:graphicData>
    </a:graphic>
  </wp:inline>
</w:drawing>`;
}

/**
 * Генерация параграфа с изображением
 * @param {Object} imageInfo - Информация об изображении
 * @param {Object} context - Контекст с функциями addImage и т.д.
 * @param {Object} styles - Конфигурация стилей
 * @returns {string} XML строка параграфа
 */
function buildImageParagraph(imageInfo, context, styles) {
  const { url, alt, attributes } = imageInfo;
  
  // Проверяем, что есть функция добавления изображения
  if (!context.addImage) {
    // Если нет - просто placeholder
    return paragraph(`<w:r><w:t>[Изображение: ${url}]</w:t></w:r>`, {
      align: 'center'
    });
  }
  
  // Добавляем изображение и получаем данные
  const imageData = context.addImage(url, attributes);
  
  if (!imageData) {
    return paragraph(`<w:r><w:t>[Изображение не найдено: ${url}]</w:t></w:r>`, {
      align: 'center'
    });
  }
  
  // Генерируем XML изображения
  const drawingXml = buildImageXml({
    rId: imageData.rId,
    name: imageData.name,
    width: imageData.widthEmu,
    height: imageData.heightEmu,
    alt: alt || imageData.name,
    docPrId: imageData.docPrId
  });
  
  // Оборачиваем в параграф
  return `<w:p>
  <w:pPr>
    <w:jc w:val="center"/>
  </w:pPr>
  <w:r>
    ${drawingXml}
  </w:r>
</w:p>`;
}

/**
 * Определение типа контента для изображения
 * @param {string} filename - Имя файла
 * @returns {string} MIME тип
 */
function getImageContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff'
  };
  return types[ext] || 'image/png';
}

module.exports = {
  buildImageXml,
  buildImageParagraph,
  getImageDimensions,
  pixelsToEmu,
  parseWidthAttribute,
  getImageContentType
};
