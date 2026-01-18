/**
 * Function Table Builder - генерация функциональных таблиц ЧТЗ
 */

const { escapeXml } = require('../utils/xml-utils');
const { buildTable, buildTableRow, buildTableCell } = require('./table-builder');
const { buildImageParagraph } = require('./image-builder');

/**
 * Парсинг атрибутов изображения из URL
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
 * Обработка форматирования текста (жирный)
 */
function processTextFormatting(text) {
  const parts = [];
  const boldRegex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  
  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.substring(lastIndex, match.index), bold: false });
    }
    parts.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), bold: false });
  }
  
  if (parts.length === 0) {
    return `<w:r><w:t>${escapeXml(text)}</w:t></w:r>`;
  }
  
  return parts.map(p => {
    const escaped = escapeXml(p.text);
    if (p.bold) {
      return `<w:r><w:rPr><w:b/></w:rPr><w:t>${escaped}</w:t></w:r>`;
    }
    return `<w:r><w:t>${escaped}</w:t></w:r>`;
  }).join('');
}

/**
 * Парсинг Markdown сценария
 */
function parseScenarioMarkdown(scenarioText) {
  const lines = scenarioText.split('\n');
  const result = [];
  let currentList = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Проверка на изображение: ![alt](url) или ![alt](url){attrs} или ![alt](url{attrs})
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)(\{[^}]+\})?$/);
    if (imageMatch) {
      if (currentList) {
        result.push(currentList);
        currentList = null;
      }
      const alt = imageMatch[1];
      let url = imageMatch[2];
      let attributes = {};
      
      // Атрибуты могут быть внутри URL или после скобки
      // Вариант 1: ![alt](url{attrs})
      const attrInUrl = url.match(/^(.+?)\{(.+?)\}$/);
      if (attrInUrl) {
        url = attrInUrl[1];
        const attrStr = attrInUrl[2];
        const attrRegex = /(\w+)="([^"]+)"/g;
        let m;
        while ((m = attrRegex.exec(attrStr)) !== null) {
          attributes[m[1]] = m[2];
        }
      }
      // Вариант 2: ![alt](url){attrs}
      else if (imageMatch[3]) {
        const attrStr = imageMatch[3].slice(1, -1); // убираем { и }
        const attrRegex = /(\w+)="([^"]+)"/g;
        let m;
        while ((m = attrRegex.exec(attrStr)) !== null) {
          attributes[m[1]] = m[2];
        }
      }
      
      result.push({ type: 'image', url, alt, attributes });
      continue;
    }
    
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      if (!currentList || currentList.type !== 'numbered') {
        if (currentList) result.push(currentList);
        currentList = { type: 'numbered', items: [] };
      }
      currentList.items.push(numberedMatch[2]);
      continue;
    }
    
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (!currentList || currentList.type !== 'bullet') {
        if (currentList) result.push(currentList);
        currentList = { type: 'bullet', items: [] };
      }
      currentList.items.push(bulletMatch[1]);
      continue;
    }
    
    if (currentList) {
      result.push(currentList);
      currentList = null;
    }
    result.push({ type: 'text', content: trimmed });
  }
  
  if (currentList) {
    result.push(currentList);
  }
  
  return result;
}

/**
 * Генерация XML для сценария
 */
function buildScenarioContent(scenarioText, styles, context = {}) {
  if (!scenarioText) return '<w:p/>';
  
  const parsed = parseScenarioMarkdown(scenarioText);
  const result = [];
  
  for (const item of parsed) {
    if (item.type === 'text') {
      const runs = processTextFormatting(item.content);
      result.push(`<w:p>${runs}</w:p>`);
    }
    else if (item.type === 'numbered') {
      item.items.forEach((text) => {
        const runs = processTextFormatting(text);
        result.push(`<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${styles.numberingIds.decimal}"/></w:numPr></w:pPr>${runs}</w:p>`);
      });
    }
    else if (item.type === 'bullet') {
      item.items.forEach(text => {
        const runs = processTextFormatting(text);
        result.push(`<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${styles.numberingIds.bullet}"/></w:numPr></w:pPr>${runs}</w:p>`);
      });
    }
    else if (item.type === 'image') {
      // Генерируем изображение
      const imagePara = buildImageParagraph({
        url: item.url,
        alt: item.alt,
        attributes: item.attributes
      }, context, styles);
      result.push(imagePara);
    }
  }
  
  return result.length > 0 ? result.join('') : '<w:p/>';
}

/**
 * Проверка, является ли строка валидным URL (http:// или https://)
 */
function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Генерация функциональной таблицы ЧТЗ
 */
function buildFunctionTable(directiveData, styles, context = {}) {
  const {
    id,
    function: funcDescription,
    task,
    taskUrl,
    scenario
  } = directiveData;

  const padding = styles.table.cellPadding;
  const headerBg = styles.colors.tableHeaderBackground;
  const headerTextColor = styles.colors.tableHeaderText || 'FFFFFF';

  const col1 = 1500;
  const col2 = 8000;

  const rows = [];

  // Строка 1: Функция
  const funcRuns = processTextFormatting(funcDescription || '');
  const functionContent = `<w:p><w:r><w:t>• </w:t></w:r>${funcRuns}</w:p>`;

  rows.push(buildTableRow([
    buildTableCell(
      `<w:p><w:r><w:rPr><w:b/><w:color w:val="${headerTextColor}"/></w:rPr><w:t>Функция</w:t></w:r></w:p>`,
      { width: col1, background: headerBg, padding, vAlign: 'top' }
    ),
    buildTableCell(functionContent, { width: col2, padding })
  ]));

  // Строка 2: Номер задачи
  let taskContent;
  // Создаём гиперссылку только для валидных URL (http:// или https://)
  if (taskUrl && isValidUrl(taskUrl) && context.addHyperlink) {
    const rId = context.addHyperlink(taskUrl);
    taskContent = `<w:p><w:hyperlink r:id="${rId}"><w:r><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr><w:t>${escapeXml(task || taskUrl)}</w:t></w:r></w:hyperlink></w:p>`;
  } else if (task) {
    // Для невалидных URL ("—", пустые) отображаем task как обычный текст
    taskContent = `<w:p><w:r><w:t>${escapeXml(task)}</w:t></w:r></w:p>`;
  } else {
    taskContent = '<w:p/>';
  }
  
  rows.push(buildTableRow([
    buildTableCell(
      `<w:p><w:r><w:rPr><w:b/><w:color w:val="${headerTextColor}"/></w:rPr><w:t>№ задачи в реестре ФТТ</w:t></w:r></w:p>`,
      { width: col1, background: headerBg, padding, vAlign: 'top' }
    ),
    buildTableCell(taskContent, { width: col2, padding })
  ]));
  
  // Строка 3: Сценарий
  const scenarioContent = buildScenarioContent(scenario, styles, context);
  
  rows.push(buildTableRow([
    buildTableCell(
      `<w:p><w:r><w:rPr><w:b/><w:color w:val="${headerTextColor}"/></w:rPr><w:t>Сценарий</w:t></w:r></w:p>`,
      { width: col1, background: headerBg, padding, vAlign: 'top' }
    ),
    buildTableCell(scenarioContent, { width: col2, padding })
  ]));
  
  let table = buildTable(rows, {
    columnWidths: [col1, col2],
    borders: true,
    borderColor: styles.colors.tableBorder
  });
  
  // Добавляем закладку если есть ID
  if (id && context.nextBookmarkId) {
    const bookmarkId = context.nextBookmarkId();
    const bookmarkPara = `<w:p><w:bookmarkStart w:id="${bookmarkId}" w:name="${id}"/><w:bookmarkEnd w:id="${bookmarkId}"/></w:p>`;
    table = bookmarkPara + table;
  }
  
  return table;
}

module.exports = {
  buildFunctionTable,
  buildScenarioContent,
  parseScenarioMarkdown,
  processTextFormatting
};
