/**
 * Document Builder - сборка полного document.xml
 */

const { documentHeader, documentFooter, paragraph, pageBreak } = require('../utils/xml-utils');
const { buildDocumentHeader } = require('./meta-builder');
const { buildContent, buildHeading } = require('./content-builder');
const { buildTableFromAst } = require('./table-builder');
const { buildTermsTable } = require('./terms-builder');
const { buildChangesTable } = require('./changes-builder');
const { buildFunctionTable } = require('./function-table-builder');
const { buildImageParagraph } = require('./image-builder');
const { DIRECTIVE_TYPES } = require('../parser/directives');

/**
 * Генерация блока примечания/предупреждения
 * @param {Object} data - Данные директивы note
 * @param {Object} styles - Конфигурация стилей
 * @param {Object} context - Контекст
 * @returns {string} XML строка
 */
function buildNoteBlock(data, styles, context) {
  const { noteType, text } = data;
  const { buildTable, buildTableRow, buildTableCell } = require('./table-builder');
  const { escapeXml } = require('../utils/xml-utils');
  
  let bgColor = '';
  
  switch (noteType) {
    case 'warning':
      bgColor = styles.colors.warning || 'FFF3CD';
      break;
    case 'danger':
      bgColor = 'F8D7DA';
      break;
    case 'info':
    default:
      bgColor = 'D1ECF1';
      break;
  }
  
  // Обрабатываем текст с Markdown-форматированием
  let content = '';
  if (text) {
    // Разбиваем на строки и обрабатываем каждую
    const lines = text.split('\n').filter(l => l.trim());
    const paragraphs = lines.map(line => {
      // Обработка жирного текста
      const parts = [];
      const boldRegex = /\*\*([^*]+)\*\*/g;
      let lastIndex = 0;
      let match;
      
      while ((match = boldRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push(`<w:r><w:t xml:space="preserve">${escapeXml(line.substring(lastIndex, match.index))}</w:t></w:r>`);
        }
        parts.push(`<w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(match[1])}</w:t></w:r>`);
        lastIndex = match.index + match[0].length;
      }
      
      if (lastIndex < line.length) {
        parts.push(`<w:r><w:t xml:space="preserve">${escapeXml(line.substring(lastIndex))}</w:t></w:r>`);
      }
      
      if (parts.length === 0) {
        parts.push(`<w:r><w:t>${escapeXml(line)}</w:t></w:r>`);
      }
      
      return `<w:p>${parts.join('')}</w:p>`;
    });
    content = paragraphs.join('');
  }
  
  const cell = buildTableCell(content || paragraph(''), {
    background: bgColor,
    padding: { top: 120, bottom: 120, left: 200, right: 200 }
  });
  
  const row = buildTableRow([cell]);
  
  return buildTable([row], {
    width: 5000,
    widthType: 'pct',
    borders: true,
    borderColor: bgColor
  });
}

/**
 * Генерация пустого раздела
 * @param {Object} data - Данные директивы empty-section
 * @param {Object} styles - Конфигурация стилей
 * @returns {string} XML строка
 */
function buildEmptySection(data, styles) {
  const text = data.text || 'Раздел не применим для данного документа.';
  
  return paragraph(
    `<w:r><w:rPr><w:i/><w:color w:val="808080"/></w:rPr><w:t>${text}</w:t></w:r>`,
    { style: styles.styleIds.normal }
  );
}

/**
 * Обработка узла AST с директивой
 * @param {Object} node - AST узел с directiveData
 * @param {Object} styles - Конфигурация стилей
 * @param {Object} context - Контекст
 * @returns {string} XML строка
 */
function processDirectiveNode(node, styles, context) {
  const data = node.directiveData;
  
  if (!data || !data.type) {
    return '';
  }
  
  switch (data.type) {
    case DIRECTIVE_TYPES.TERMS:
      return buildTermsTable(data, styles);
    
    case DIRECTIVE_TYPES.CHANGES_TABLE:
      return buildChangesTable(data, styles);
    
    case DIRECTIVE_TYPES.FUNCTION_TABLE:
      return buildFunctionTable(data, styles, context);
    
    case DIRECTIVE_TYPES.NOTE:
      return buildNoteBlock(data, styles, context);
    
    case DIRECTIVE_TYPES.EMPTY_SECTION:
      return buildEmptySection(data, styles);
    
    default:
      if (node.children) {
        return node.children
          .map(child => processAstNode(child, styles, context))
          .join('');
      }
      return '';
  }
}

/**
 * Парсинг атрибутов изображения из URL
 * @param {string} url - URL с возможными атрибутами {width="70%"}
 * @returns {Object} Атрибуты
 */
function parseImageAttributes(url) {
  const attributes = {};
  const match = url.match(/\{([^}]+)\}$/);
  
  if (match) {
    const attrStr = match[1];
    const attrRegex = /(\w+)="([^"]+)"/g;
    let m;
    while ((m = attrRegex.exec(attrStr)) !== null) {
      attributes[m[1]] = m[2];
    }
  }
  
  return attributes;
}

/**
 * Обработка узла AST
 * @param {Object} node - AST узел
 * @param {Object} styles - Конфигурация стилей
 * @param {Object} context - Контекст
 * @returns {string} XML строка
 */
function processAstNode(node, styles, context) {
  if (!node) return '';
  
  // Если есть данные директивы - обрабатываем как директиву
  if (node.directiveData) {
    return processDirectiveNode(node, styles, context);
  }
  
  switch (node.type) {
    case 'root':
      return node.children
        .map(child => processAstNode(child, styles, context))
        .join('');
    
    case 'heading':
      return buildHeading(node, styles, context);
    
    case 'paragraph':
      // Проверяем, есть ли изображение внутри
      const hasImage = node.children && node.children.some(c => c.type === 'image');
      if (hasImage) {
        return node.children
          .map(child => {
            if (child.type === 'image') {
              // Используем атрибуты из AST узла (установленные парсером)
              // или извлекаем из URL как fallback
              const attributes = child.imageAttributes || parseImageAttributes(child.url);
              return buildImageParagraph({
                url: child.url,
                alt: child.alt,
                attributes
              }, context, styles);
            }
            return '';
          })
          .join('');
      }
      return buildContent(node, styles, context);
    
    case 'list':
      return buildContent(node, styles, context);
    
    case 'table':
      return buildTableFromAst(node, styles, context);
    
    case 'code':
      return buildContent(node, styles, context);
    
    case 'blockquote':
      return buildContent(node, styles, context);
    
    case 'thematicBreak':
      return paragraph('', { style: styles.styleIds.normal });
    
    case 'image':
      return buildImageParagraph({
        url: node.url,
        alt: node.alt,
        attributes: parseImageAttributes(node.url)
      }, context, styles);
    
    case 'containerDirective':
    case 'leafDirective':
    case 'textDirective':
      if (node.directiveData) {
        return processDirectiveNode(node, styles, context);
      }
      return '';
    
    default:
      if (node.children) {
        return node.children
          .map(child => processAstNode(child, styles, context))
          .join('');
      }
      return '';
  }
}

/**
 * Сборка полного document.xml
 * @param {Object} parsedData - Распарсенные данные документа
 * @param {Object} styles - Конфигурация стилей
 * @param {Object} context - Контекст (addHyperlink, addImage, и т.д.)
 * @returns {string} Полный XML документа
 */
function buildDocument(parsedData, styles, context = {}) {
  const parts = [];
  
  // 1. XML заголовок и открывающие теги
  parts.push(documentHeader());
  
  // 2. Шапка документа (метаданные, история, связанные документы)
  parts.push(buildDocumentHeader({
    metadata: parsedData.metadata,
    history: parsedData.history,
    relatedDocs: parsedData.relatedDocs
  }, styles));
  
  // 3. Разрыв страницы после шапки
  parts.push(pageBreak());
  
  // 4. Основной контент из AST
  if (parsedData.ast) {
    const contentXml = processAstNode(parsedData.ast, styles, context);
    parts.push(contentXml);
  }
  
  // 5. Закрывающие теги и настройки секции
  parts.push(documentFooter(styles));
  
  return parts.join('\n');
}

/**
 * Создание контекста для сборки документа
 * @param {Object} options - Опции
 * @returns {Object} Контекст
 */
function createBuildContext(options = {}) {
  let bookmarkCounter = 1;
  let docPrCounter = 1;
  const hyperlinks = new Map();
  const images = new Map();
  
  return {
    nextBookmarkId() {
      return String(bookmarkCounter++);
    },
    
    nextDocPrId() {
      return docPrCounter++;
    },
    
    addHyperlink(url) {
      if (hyperlinks.has(url)) {
        return hyperlinks.get(url);
      }
      
      const rId = `rId${options.startRelId + hyperlinks.size}`;
      hyperlinks.set(url, rId);
      
      if (options.onHyperlink) {
        options.onHyperlink(url, rId);
      }
      
      return rId;
    },
    
    addImage(imagePath, attributes = {}) {
      const cleanPath = imagePath.replace(/\{[^}]+\}$/, '');
      
      if (images.has(cleanPath)) {
        return images.get(cleanPath);
      }
      
      if (options.onImage) {
        const imageData = options.onImage(cleanPath, attributes);
        if (imageData) {
          images.set(cleanPath, imageData);
          return imageData;
        }
      }
      
      return null;
    },
    
    getHyperlinks() {
      return hyperlinks;
    },
    
    getImages() {
      return images;
    }
  };
}

module.exports = {
  buildDocument,
  createBuildContext,
  processAstNode,
  processDirectiveNode,
  buildNoteBlock,
  buildEmptySection
};
