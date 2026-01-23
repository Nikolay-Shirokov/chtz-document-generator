/**
 * Assembler - сборка финального docx файла
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { RelationshipsManager, createBaseRelationships } = require('./relationships');
const {
  unpackTemplate,
  packToDocx,
  updateContentTypes,
  readRelationships,
  writeRelationships,
  writeDocument,
  copyImageToMedia,
  getExistingImages
} = require('./template-handler');
const { getImageDimensions, pixelsToEmu, parseWidthAttribute } = require('../builders/image-builder');

/**
 * Сборка docx документа
 * @param {Object} options - Опции сборки
 * @param {string} options.templatePath - Путь к шаблону
 * @param {string} options.outputPath - Путь к выходному файлу
 * @param {string} options.documentXml - Сгенерированный document.xml
 * @param {Map} options.hyperlinks - Карта гиперссылок (url -> rId)
 * @param {Array} options.images - Массив изображений [{sourcePath, attributes}]
 * @param {string} options.imagesDir - Директория с изображениями
 */
async function assembleDocx(options) {
  const {
    templatePath,
    outputPath,
    documentXml,
    hyperlinks = new Map(),
    images = [],
    imagesDir = '.'
  } = options;
  
  // Создаём временную директорию
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chtz-'));
  
  try {
    // 1. Распаковываем шаблон
    const paths = unpackTemplate(templatePath, tempDir);
    
    // 2. Создаём менеджер relationships
    const relsManager = createBaseRelationships();
    
    // Если есть существующие rels - загружаем их
    if (fs.existsSync(paths.relsPath)) {
      const existingRels = readRelationships(paths.relsPath);
      // Можем использовать для проверки, но используем базовые
    }
    
    // 3. Добавляем гиперссылки
    const hyperlinkMapping = new Map();
    for (const [url, _] of hyperlinks) {
      const rId = relsManager.addHyperlink(url);
      hyperlinkMapping.set(url, rId);
    }
    
    // 4. Обрабатываем изображения
    const imageRIdMapping = new Map(); // oldRId -> newRId
    const addedExtensions = new Set();
    let imageCounter = getExistingImages(paths.mediaDir).length + 1;
    
    for (const imageInfo of images) {
      const { sourcePath, attributes, rId: oldRId } = imageInfo;
      
      // sourcePath уже полный путь с createAssemblyContext
      let fullImagePath = sourcePath;
      
      if (!fs.existsSync(fullImagePath)) {
        console.warn(`Изображение не найдено: ${fullImagePath}`);
        continue;
      }
      
      // Определяем имя файла в media
      const ext = path.extname(fullImagePath);
      const imageName = `image${imageCounter++}${ext}`;
      
      // Копируем изображение
      copyImageToMedia(fullImagePath, paths.mediaDir, imageName);
      
      // Добавляем relationship
      const newRId = relsManager.addImage(`media/${imageName}`);
      
      // Сохраняем маппинг старого rId на новый
      imageRIdMapping.set(oldRId, newRId);
      
      addedExtensions.add(ext);
    }
    
    // 5. Обновляем document.xml с правильными rId
    let finalDocumentXml = documentXml;

    // Заменяем placeholder rId для гиперссылок
    // hyperlinks Map содержит: url -> temporaryRId (rId100, rId101...)
    // hyperlinkMapping содержит: url -> finalRId (rId9, rId10...)
    // Нужно заменить все временные rId на финальные
    for (const [url, tempRId] of hyperlinks) {
      const finalRId = hyperlinkMapping.get(url);
      if (finalRId) {
        // Заменяем временный ID на финальный в гиперссылках
        finalDocumentXml = finalDocumentXml.replace(
          new RegExp(`r:id="${escapeRegex(tempRId)}"`, 'g'),
          `r:id="${finalRId}"`
        );
      }
    }
    
    // Заменяем placeholder rId для изображений
    // Сначала заменяем на временные уникальные placeholders, затем на финальные rId
    const tempReplacements = [];
    for (const [oldRId, newRId] of imageRIdMapping) {
      const tempPlaceholder = `__IMG_PLACEHOLDER_${oldRId}__`;
      tempReplacements.push({ oldRId, newRId, tempPlaceholder });
      
      // Шаг 1: заменяем oldRId на временный placeholder
      finalDocumentXml = finalDocumentXml.replace(
        new RegExp(`r:embed="${escapeRegex(oldRId)}"`, 'g'),
        `r:embed="${tempPlaceholder}"`
      );
    }
    
    // Шаг 2: заменяем placeholders на финальные rId
    for (const { newRId, tempPlaceholder } of tempReplacements) {
      finalDocumentXml = finalDocumentXml.replace(
        new RegExp(`r:embed="${escapeRegex(tempPlaceholder)}"`, 'g'),
        `r:embed="${newRId}"`
      );
    }
    
    // 6. Записываем файлы
    writeDocument(paths.documentPath, finalDocumentXml);
    writeRelationships(paths.relsPath, relsManager.toXml());
    
    // 7. Обновляем Content_Types если нужно
    if (addedExtensions.size > 0) {
      updateContentTypes(paths.contentTypesPath, Array.from(addedExtensions));
    }
    
    // 8. Упаковываем в docx
    packToDocx(tempDir, outputPath);
    
    return {
      success: true,
      outputPath,
      hyperlinkMapping,
      imageRIdMapping
    };
    
  } finally {
    // Очистка временной директории
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Escape специальных символов для RegExp
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Создание контекста сборки для использования в билдерах
 * @param {Object} options
 * @returns {Object} Контекст с функциями addHyperlink, addImage
 */
function createAssemblyContext(options = {}) {
  const { imagesDir = '.' } = options;
  
  const hyperlinks = new Map();
  const images = [];
  let imageIdCounter = 10;
  let hyperlinkIdCounter = 100;
  
  return {
    addHyperlink(url) {
      if (hyperlinks.has(url)) {
        return hyperlinks.get(url);
      }
      const rId = `rId${hyperlinkIdCounter++}`;
      hyperlinks.set(url, rId);
      return rId;
    },
    
    addImage(imagePath, attributes = {}) {
      // Убираем атрибуты из пути если есть
      let cleanPath = imagePath.replace(/\{[^}]+\}$/, '');

      // Если путь относительный и начинается с "images/", убираем этот префикс
      // так как imagesDir уже указывает на папку images
      if (!path.isAbsolute(cleanPath) && cleanPath.startsWith('images/')) {
        cleanPath = cleanPath.substring('images/'.length);
      }

      // Проверяем, существует ли файл
      let fullPath = cleanPath;
      if (!path.isAbsolute(cleanPath)) {
        fullPath = path.join(imagesDir, cleanPath);
      }
      
      if (!fs.existsSync(fullPath)) {
        console.warn(`Изображение не найдено: ${fullPath}`);
        return null;
      }
      
      const rId = `rId${imageIdCounter}`;
      const docPrId = imageIdCounter;
      imageIdCounter++;
      
      // Получаем размеры
      const dimensions = getImageDimensions(fullPath);
      const targetWidth = parseWidthAttribute(attributes.width, dimensions.width, 550);
      const aspectRatio = dimensions.height / dimensions.width;
      const targetHeight = Math.round(targetWidth * aspectRatio);
      
      const imageData = {
        sourcePath: fullPath, // используем полный путь, уже разрешённый
        attributes,
        rId,
        name: path.basename(cleanPath),
        widthEmu: pixelsToEmu(targetWidth),
        heightEmu: pixelsToEmu(targetHeight),
        docPrId
      };
      
      images.push(imageData);
      
      return imageData;
    },
    
    getHyperlinks() {
      return hyperlinks;
    },
    
    getImages() {
      return images;
    },
    
    nextBookmarkId: (() => {
      let counter = 1;
      return () => String(counter++);
    })()
  };
}

module.exports = {
  assembleDocx,
  createAssemblyContext
};
