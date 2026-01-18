/**
 * XML утилиты для генерации Word документов
 */

// Пространства имён XML для Word документов
const NAMESPACES = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  w14: 'http://schemas.microsoft.com/office/word/2010/wordml',
  wpc: 'http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas',
  mc: 'http://schemas.openxmlformats.org/markup-compatibility/2006'
};

/**
 * Экранирование специальных символов XML
 * @param {string} text - Исходный текст
 * @returns {string} Экранированный текст
 */
function escapeXml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Создание XML атрибутов из объекта
 * @param {Object} attrs - Объект с атрибутами
 * @returns {string} Строка атрибутов
 */
function attrs(obj) {
  if (!obj) return '';
  return Object.entries(obj)
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
    .join('');
}

/**
 * Создание XML тега
 * @param {string} name - Имя тега
 * @param {Object} attributes - Атрибуты
 * @param {string|Array} content - Содержимое
 * @returns {string} XML строка
 */
function tag(name, attributes = {}, content = null) {
  const attrStr = attrs(attributes);
  
  if (content === null || content === undefined) {
    return `<${name}${attrStr}/>`;
  }
  
  const contentStr = Array.isArray(content) ? content.join('') : content;
  return `<${name}${attrStr}>${contentStr}</${name}>`;
}

/**
 * Создание текстового элемента Word <w:t>
 * @param {string} text - Текст
 * @param {boolean} preserveSpace - Сохранять пробелы
 * @returns {string} XML строка
 */
function wText(text, preserveSpace = false) {
  const escapedText = escapeXml(text);
  const spaceAttr = preserveSpace || /^\s|\s$/.test(text) ? ' xml:space="preserve"' : '';
  return `<w:t${spaceAttr}>${escapedText}</w:t>`;
}

/**
 * Создание run (фрагмент текста с форматированием)
 * @param {string} text - Текст
 * @param {Object} options - Опции форматирования
 * @returns {string} XML строка <w:r>
 */
function textRun(text, options = {}) {
  const rPr = [];
  
  if (options.bold) {
    rPr.push('<w:b/>');
  }
  if (options.italic) {
    rPr.push('<w:i/>');
  }
  if (options.font) {
    rPr.push(`<w:rFonts w:ascii="${options.font}" w:hAnsi="${options.font}" w:cs="${options.font}"/>`);
  }
  if (options.size) {
    rPr.push(`<w:sz w:val="${options.size}"/>`);
    rPr.push(`<w:szCs w:val="${options.size}"/>`);
  }
  if (options.color) {
    rPr.push(`<w:color w:val="${options.color}"/>`);
  }
  if (options.underline) {
    rPr.push('<w:u w:val="single"/>');
  }
  if (options.strike) {
    rPr.push('<w:strike/>');
  }
  
  const rPrXml = rPr.length > 0 ? `<w:rPr>${rPr.join('')}</w:rPr>` : '';
  
  return `<w:r>${rPrXml}${wText(text)}</w:r>`;
}

/**
 * Создание параграфа
 * @param {string|Array} content - Содержимое (runs)
 * @param {Object} options - Опции форматирования
 * @returns {string} XML строка <w:p>
 */
function paragraph(content, options = {}) {
  const pPr = [];
  
  // Стиль параграфа
  if (options.style) {
    pPr.push(`<w:pStyle w:val="${options.style}"/>`);
  }
  
  // Нумерация (списки)
  if (options.numId !== undefined) {
    pPr.push(`<w:numPr><w:ilvl w:val="${options.level || 0}"/><w:numId w:val="${options.numId}"/></w:numPr>`);
  }
  
  // Отступы
  if (options.indent) {
    const indentAttrs = [];
    if (options.indent.left !== undefined) indentAttrs.push(`w:left="${options.indent.left}"`);
    if (options.indent.right !== undefined) indentAttrs.push(`w:right="${options.indent.right}"`);
    if (options.indent.hanging !== undefined) indentAttrs.push(`w:hanging="${options.indent.hanging}"`);
    if (options.indent.firstLine !== undefined) indentAttrs.push(`w:firstLine="${options.indent.firstLine}"`);
    if (indentAttrs.length > 0) {
      pPr.push(`<w:ind ${indentAttrs.join(' ')}/>`);
    }
  }
  
  // Выравнивание
  if (options.align) {
    const alignMap = { left: 'left', center: 'center', right: 'right', justify: 'both' };
    pPr.push(`<w:jc w:val="${alignMap[options.align] || options.align}"/>`);
  }
  
  // Интервалы
  if (options.spacing) {
    const spacingAttrs = [];
    if (options.spacing.before !== undefined) spacingAttrs.push(`w:before="${options.spacing.before}"`);
    if (options.spacing.after !== undefined) spacingAttrs.push(`w:after="${options.spacing.after}"`);
    if (options.spacing.line !== undefined) spacingAttrs.push(`w:line="${options.spacing.line}"`);
    if (spacingAttrs.length > 0) {
      pPr.push(`<w:spacing ${spacingAttrs.join(' ')}/>`);
    }
  }
  
  // Сохранять с следующим
  if (options.keepNext) {
    pPr.push('<w:keepNext/>');
  }
  
  // Разрыв страницы перед
  if (options.pageBreakBefore) {
    pPr.push('<w:pageBreakBefore/>');
  }
  
  const pPrXml = pPr.length > 0 ? `<w:pPr>${pPr.join('')}</w:pPr>` : '';
  const contentStr = Array.isArray(content) ? content.join('') : (content || '');
  
  return `<w:p>${pPrXml}${contentStr}</w:p>`;
}

/**
 * Создание гиперссылки
 * @param {string} rId - Relationship ID
 * @param {string} text - Текст ссылки
 * @param {Object} options - Опции
 * @returns {string} XML строка
 */
function hyperlink(rId, text, options = {}) {
  const runContent = textRun(text, {
    color: options.color || '0563C1',
    underline: true,
    ...options
  });
  
  return `<w:hyperlink r:id="${rId}">${runContent}</w:hyperlink>`;
}

/**
 * Создание закладки (bookmark) для внутренних ссылок
 * @param {string} id - ID закладки
 * @param {string} name - Имя закладки
 * @param {string} content - Содержимое
 * @returns {string} XML строка
 */
function bookmark(id, name, content) {
  return `<w:bookmarkStart w:id="${id}" w:name="${name}"/>${content}<w:bookmarkEnd w:id="${id}"/>`;
}

/**
 * Создание внутренней ссылки на закладку
 * @param {string} anchor - Имя закладки
 * @param {string} text - Текст ссылки
 * @returns {string} XML строка
 */
function internalLink(anchor, text) {
  const runContent = textRun(text, {
    color: '0563C1',
    underline: true
  });
  
  return `<w:hyperlink w:anchor="${anchor}">${runContent}</w:hyperlink>`;
}

/**
 * Генерация заголовка документа XML
 * @returns {string} XML declaration и открывающий тег document
 */
function documentHeader() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="${NAMESPACES.wpc}" xmlns:mc="${NAMESPACES.mc}" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="${NAMESPACES.r}" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="${NAMESPACES.wp}" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="${NAMESPACES.w}" xmlns:w14="${NAMESPACES.w14}" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">
<w:body>`;
}

/**
 * Генерация закрывающей части документа с настройками секции
 * @param {Object} styles - Конфигурация стилей
 * @returns {string} XML строка
 */
function documentFooter(styles) {
  const page = styles.page;
  const rels = styles.templateRels;
  
  return `<w:sectPr>
<w:pgSz w:w="${page.width}" w:h="${page.height}"/>
<w:pgMar w:top="${page.margins.top}" w:right="${page.margins.right}" w:bottom="${page.margins.bottom}" w:left="${page.margins.left}" w:header="${page.margins.header}" w:footer="${page.margins.footer}" w:gutter="0"/>
<w:cols w:space="708"/>
<w:docGrid w:linePitch="360"/>
</w:sectPr>
</w:body>
</w:document>`;
}

/**
 * Разрыв страницы
 * @returns {string} XML строка
 */
function pageBreak() {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

module.exports = {
  NAMESPACES,
  escapeXml,
  attrs,
  tag,
  wText,
  textRun,
  paragraph,
  hyperlink,
  bookmark,
  internalLink,
  documentHeader,
  documentFooter,
  pageBreak
};
