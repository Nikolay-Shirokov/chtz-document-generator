/**
 * Content Builder - генерация XML для текстового контента
 */

const { escapeXml, textRun, paragraph, hyperlink, internalLink, bookmark } = require('../utils/xml-utils');

/**
 * Генерация XML для inline-элементов (текст с форматированием)
 * @param {Object} node - AST узел
 * @param {Object} context - Контекст (ссылки и т.д.)
 * @returns {string} XML строка runs
 */
function buildInlineContent(node, context = {}) {
  if (!node) return '';
  
  switch (node.type) {
    case 'text':
      return textRun(node.value);
    
    case 'strong':
      return node.children
        .map(child => buildInlineContentWithStyle(child, { bold: true }, context))
        .join('');
    
    case 'emphasis':
      return node.children
        .map(child => buildInlineContentWithStyle(child, { italic: true }, context))
        .join('');
    
    case 'delete': // Зачёркнутый текст
      return node.children
        .map(child => buildInlineContentWithStyle(child, { strike: true }, context))
        .join('');
    
    case 'inlineCode':
      return textRun(node.value, { font: 'Courier New', size: 20 });
    
    case 'link':
      return buildLink(node, context);
    
    case 'image':
      // Изображения обрабатываются отдельно в image-builder
      return `<!-- IMAGE: ${node.url} -->`;
    
    default:
      if (node.children) {
        return node.children.map(child => buildInlineContent(child, context)).join('');
      }
      return '';
  }
}

/**
 * Генерация inline-контента со стилем
 * @param {Object} node - AST узел
 * @param {Object} style - Стили
 * @param {Object} context - Контекст
 * @returns {string} XML строка
 */
function buildInlineContentWithStyle(node, style, context) {
  if (node.type === 'text') {
    return textRun(node.value, style);
  }
  
  // Комбинируем стили для вложенных элементов
  if (node.type === 'strong') {
    return node.children
      .map(child => buildInlineContentWithStyle(child, { ...style, bold: true }, context))
      .join('');
  }
  
  if (node.type === 'emphasis') {
    return node.children
      .map(child => buildInlineContentWithStyle(child, { ...style, italic: true }, context))
      .join('');
  }
  
  if (node.children) {
    return node.children
      .map(child => buildInlineContentWithStyle(child, style, context))
      .join('');
  }
  
  return buildInlineContent(node, context);
}

/**
 * Генерация XML для ссылки
 * @param {Object} node - AST узел link
 * @param {Object} context - Контекст с relationships
 * @returns {string} XML строка
 */
function buildLink(node, context) {
  const url = node.url || '';
  const text = node.children.map(c => c.type === 'text' ? c.value : '').join('');
  
  // Внутренняя ссылка (anchor)
  if (url.startsWith('#')) {
    const anchor = url.substring(1);
    return internalLink(anchor, text || url);
  }
  
  // Внешняя ссылка
  if (context.addHyperlink) {
    const rId = context.addHyperlink(url);
    return hyperlink(rId, text || url);
  }
  
  // Если нет функции добавления - просто текст со стилем ссылки
  return textRun(text || url, { color: '0563C1', underline: true });
}

/**
 * Генерация XML для параграфа
 * @param {Object} node - AST узел paragraph
 * @param {Object} styles - Конфигурация стилей
 * @param {Object} context - Контекст
 * @returns {string} XML строка
 */
function buildParagraph(node, styles, context = {}) {
  const runs = node.children
    .map(child => buildInlineContent(child, context))
    .join('');
  
  return paragraph(runs, {
    style: styles.styleIds.normal
  });
}

/**
 * Генерация XML для заголовка
 * @param {Object} node - AST узел heading
 * @param {Object} styles - Конфигурация стилей
 * @param {Object} context - Контекст
 * @returns {string} XML строка
 */
function buildHeading(node, styles, context = {}) {
  const level = node.depth;
  const text = node.children.map(c => buildInlineContent(c, context)).join('');
  
  // Генерируем ID для закладки
  const headingText = node.children
    .filter(c => c.type === 'text')
    .map(c => c.value)
    .join('');
  
  const bookmarkId = context.nextBookmarkId ? context.nextBookmarkId() : '0';
  const bookmarkName = headingText
    .toLowerCase()
    .replace(/[^\w\sа-яё-]/gi, '')
    .replace(/\s+/g, '-')
    .substring(0, 40) || `heading-${bookmarkId}`;
  
  // Определяем стиль заголовка
  let styleId;
  switch (level) {
    case 1:
      styleId = styles.styleIds.heading1;
      break;
    case 2:
      styleId = styles.styleIds.heading2;
      break;
    case 3:
      styleId = styles.styleIds.heading3;
      break;
    case 4:
      styleId = styles.styleIds.heading4;
      break;
    default:
      styleId = styles.styleIds.heading3;
      break;
  }
  
  // Создаём параграф с закладкой
  const content = bookmark(bookmarkId, bookmarkName, text);
  
  return paragraph(content, {
    style: styleId,
    keepNext: true
  });
}

/**
 * Генерация XML для списка
 * @param {Object} node - AST узел list
 * @param {Object} styles - Конфигурация стилей
 * @param {Object} context - Контекст
 * @param {number} level - Уровень вложенности (0-based)
 * @returns {string} XML строка
 */
function buildList(node, styles, context = {}, level = 0) {
  const isOrdered = node.ordered;
  const numId = isOrdered ? styles.numberingIds.decimal : styles.numberingIds.bullet;
  
  return node.children
    .map(item => buildListItem(item, styles, context, level, numId))
    .join('');
}

/**
 * Генерация XML для элемента списка
 * @param {Object} node - AST узел listItem
 * @param {Object} styles - Конфигурация стилей
 * @param {Object} context - Контекст
 * @param {number} level - Уровень вложенности
 * @param {string} numId - ID нумерации
 * @returns {string} XML строка
 */
function buildListItem(node, styles, context, level, numId) {
  const result = [];
  
  for (const child of node.children) {
    if (child.type === 'paragraph') {
      // Текст элемента списка
      const runs = child.children
        .map(c => buildInlineContent(c, context))
        .join('');
      
      result.push(paragraph(runs, {
        numId: numId,
        level: level,
        style: styles.styleIds.listParagraph
      }));
    } else if (child.type === 'list') {
      // Вложенный список
      result.push(buildList(child, styles, context, level + 1));
    }
  }
  
  return result.join('');
}

/**
 * Генерация XML для блока кода
 * @param {Object} node - AST узел code
 * @param {Object} styles - Конфигурация стилей
 * @returns {string} XML строка
 */
function buildCodeBlock(node, styles) {
  const lines = node.value.split('\n');
  
  return lines.map(line => {
    const run = textRun(line, { font: 'Courier New', size: 20 });
    return paragraph(run, {
      style: styles.styleIds.normal,
      spacing: { before: 0, after: 0 }
    });
  }).join('');
}

/**
 * Генерация XML для blockquote
 * @param {Object} node - AST узел blockquote
 * @param {Object} styles - Конфигурация стилей
 * @param {Object} context - Контекст
 * @returns {string} XML строка
 */
function buildBlockquote(node, styles, context) {
  return node.children
    .map(child => {
      if (child.type === 'paragraph') {
        const runs = child.children
          .map(c => buildInlineContent(c, context))
          .join('');
        
        return paragraph(runs, {
          style: styles.styleIds.normal,
          indent: { left: 720 } // Отступ для цитаты
        });
      }
      return '';
    })
    .join('');
}

/**
 * Основная функция построения контента из AST узла
 * @param {Object} node - AST узел
 * @param {Object} styles - Конфигурация стилей
 * @param {Object} context - Контекст
 * @returns {string} XML строка
 */
function buildContent(node, styles, context = {}) {
  if (!node) return '';
  
  switch (node.type) {
    case 'heading':
      return buildHeading(node, styles, context);
    
    case 'paragraph':
      return buildParagraph(node, styles, context);
    
    case 'list':
      return buildList(node, styles, context);
    
    case 'code':
      return buildCodeBlock(node, styles);
    
    case 'blockquote':
      return buildBlockquote(node, styles, context);
    
    case 'thematicBreak':
      // Горизонтальная линия - просто пустой параграф с границей
      return paragraph('', {
        style: styles.styleIds.normal
      });
    
    default:
      // Для других типов пытаемся обработать children
      if (node.children) {
        return node.children
          .map(child => buildContent(child, styles, context))
          .join('');
      }
      return '';
  }
}

module.exports = {
  buildContent,
  buildInlineContent,
  buildParagraph,
  buildHeading,
  buildList,
  buildListItem,
  buildCodeBlock,
  buildBlockquote,
  buildLink
};
