/**
 * Template Styles - извлечение и использование стилей из шаблона
 * Позволяет не хардкодить стили в коде, а брать их из gpn-template.docx
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

/**
 * Извлечь стили из шаблона
 * @param {string} templatePath - Путь к шаблону docx
 * @returns {Object} Конфигурация стилей
 */
function extractStylesFromTemplate(templatePath) {
  const zip = new AdmZip(templatePath);
  
  // Читаем styles.xml
  const stylesEntry = zip.getEntry('word/styles.xml');
  const stylesXml = stylesEntry ? stylesEntry.getData().toString('utf-8') : '';
  
  // Читаем numbering.xml
  const numberingEntry = zip.getEntry('word/numbering.xml');
  const numberingXml = numberingEntry ? numberingEntry.getData().toString('utf-8') : '';
  
  // Парсим стили
  const styles = parseStyles(stylesXml);
  const numbering = parseNumbering(numberingXml);
  
  return {
    ...styles,
    numbering
  };
}

/**
 * Парсинг styles.xml
 */
function parseStyles(xml) {
  const styleMap = {};
  
  // Регулярка для извлечения стилей
  const styleRegex = /<w:style[^>]*w:styleId="([^"]+)"[^>]*>(.*?)<\/w:style>/gs;
  let match;
  
  while ((match = styleRegex.exec(xml)) !== null) {
    const styleId = match[1];
    const body = match[2];
    
    const nameMatch = body.match(/<w:name w:val="([^"]+)"/);
    const name = nameMatch ? nameMatch[1].toLowerCase() : '';
    
    styleMap[styleId] = {
      id: styleId,
      name: name,
      originalName: nameMatch ? nameMatch[1] : ''
    };
  }
  
  // Находим нужные стили по имени
  const findStyleId = (searchNames) => {
    for (const [id, style] of Object.entries(styleMap)) {
      if (searchNames.some(n => style.name.includes(n.toLowerCase()))) {
        return id;
      }
    }
    return null;
  };
  
  return {
    // Идентификаторы стилей параграфов
    styleIds: {
      heading1: findStyleByName(styleMap, 'heading 1') || '1',
      heading2: findStyleByName(styleMap, 'heading 2') || '2',
      heading3: findStyleByName(styleMap, 'heading 3') || '3',
      heading4: findStyleByName(styleMap, 'heading 4') || '4',
      heading5: findStyleByName(styleMap, 'heading 5') || '5',
      normal: findStyleByName(styleMap, 'normal') || 'a',
      listParagraph: findStyleByName(styleMap, 'list paragraph') || 'aff2',
      hyperlink: findStyleByName(styleMap, 'hyperlink') || 'aff5',
      title: findStyleByName(styleMap, 'title') || 'af6',
      tableGrid: findStyleByName(styleMap, 'table grid') || 'afa',
      toc1: findStyleByName(styleMap, 'toc 1') || '12',
      toc2: findStyleByName(styleMap, 'toc 2') || '24',
      toc3: findStyleByName(styleMap, 'toc 3') || '32',
      quote: findStyleByName(styleMap, 'quote') || '21'
    },
    
    // Все стили для отладки
    allStyles: styleMap
  };
}

/**
 * Найти styleId по имени
 */
function findStyleByName(styleMap, name) {
  const normalizedName = name.toLowerCase();
  for (const [id, style] of Object.entries(styleMap)) {
    if (style.name === normalizedName) {
      return id;
    }
  }
  return null;
}

/**
 * Парсинг numbering.xml для списков
 */
function parseNumbering(xml) {
  // Ищем abstractNum с bullet и decimal
  const abstractNums = [];
  const abstractRegex = /<w:abstractNum[^>]*w:abstractNumId="(\d+)"[^>]*>(.*?)<\/w:abstractNum>/gs;
  
  let match;
  while ((match = abstractRegex.exec(xml)) !== null) {
    const id = match[1];
    const body = match[2];
    
    // Проверяем тип нумерации
    const numFmtMatch = body.match(/<w:numFmt w:val="([^"]+)"/);
    const numFmt = numFmtMatch ? numFmtMatch[1] : '';
    
    abstractNums.push({ id, numFmt, body });
  }
  
  // Ищем numId которые ссылаются на abstractNum
  const nums = [];
  const numRegex = /<w:num w:numId="(\d+)"[^>]*>.*?<w:abstractNumId w:val="(\d+)".*?<\/w:num>/gs;
  
  while ((match = numRegex.exec(xml)) !== null) {
    nums.push({
      numId: match[1],
      abstractNumId: match[2]
    });
  }
  
  // Находим numId для bullet и decimal
  let bulletNumId = '1';
  let decimalNumId = '2';
  
  for (const num of nums) {
    const abstract = abstractNums.find(a => a.id === num.abstractNumId);
    if (abstract) {
      if (abstract.numFmt === 'bullet') {
        bulletNumId = num.numId;
      } else if (abstract.numFmt === 'decimal') {
        decimalNumId = num.numId;
      }
    }
  }
  
  return {
    bullet: bulletNumId,
    decimal: decimalNumId
  };
}

/**
 * Загрузить стили из шаблона и объединить с базовыми настройками
 */
function loadTemplateStyles(templatePath) {
  const baseStyles = require('./gpn-styles');
  
  try {
    const templateStyles = extractStylesFromTemplate(templatePath);
    
    return {
      ...baseStyles,
      styleIds: {
        ...baseStyles.styleIds,
        ...templateStyles.styleIds
      },
      numberingIds: {
        ...baseStyles.numberingIds,
        ...templateStyles.numbering
      },
      // Флаг что стили загружены из шаблона
      fromTemplate: true
    };
  } catch (error) {
    console.warn('Не удалось загрузить стили из шаблона:', error.message);
    return baseStyles;
  }
}

module.exports = {
  extractStylesFromTemplate,
  loadTemplateStyles,
  parseStyles,
  parseNumbering
};
