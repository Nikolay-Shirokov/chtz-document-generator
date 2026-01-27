/**
 * Function Table Builder - генерация функциональных таблиц ЧТЗ
 */

const { escapeXml } = require('../utils/xml-utils');
const { buildTable, buildTableRow, buildTableCell } = require('./table-builder');
const { buildImageParagraph } = require('./image-builder');
const { parseMarkdownTable } = require('../utils/markdown-table-parser');

/**
 * Создаёт w:t элемент с правильной обработкой пробелов
 * Добавляет xml:space="preserve" если текст начинается или заканчивается пробелом
 */
function buildTextElement(text) {
  const escaped = escapeXml(text);
  // Если текст содержит пробелы в начале или конце, нужен xml:space="preserve"
  const needsPreserve = /^\s|\s$/.test(text);
  const spaceAttr = needsPreserve ? ' xml:space="preserve"' : '';
  return `<w:t${spaceAttr}>${escaped}</w:t>`;
}

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
 * Обработка форматирования текста (жирный, ссылки)
 * @param {string} text - Исходный текст
 * @param {Object} context - Контекст с addHyperlink функцией
 * @returns {string} XML runs
 */
function processTextFormatting(text, context = {}) {
  if (!text) return '';

  // Сначала обрабатываем ссылки, потом жирный текст
  // Regex для markdown ссылок: [text](url) или [text](#anchor)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    // Текст до ссылки
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    // Ссылка
    parts.push({
      type: 'link',
      text: match[1],
      url: match[2]
    });
    lastIndex = match.index + match[0].length;
  }

  // Текст после последней ссылки
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }

  // Если нет ссылок, используем простую обработку bold
  if (parts.length === 0 || (parts.length === 1 && parts[0].type === 'text')) {
    return processTextWithBold(text);
  }

  // Обрабатываем каждую часть
  return parts.map(part => {
    if (part.type === 'link') {
      return buildLinkRun(part.text, part.url, context);
    }
    return processTextWithBold(part.content);
  }).join('');
}

/**
 * Обработка текста с жирным форматированием (без ссылок)
 */
function processTextWithBold(text) {
  if (!text) return '';

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
    return `<w:r>${buildTextElement(text)}</w:r>`;
  }

  return parts.map(p => {
    if (p.bold) {
      return `<w:r><w:rPr><w:b/></w:rPr>${buildTextElement(p.text)}</w:r>`;
    }
    return `<w:r>${buildTextElement(p.text)}</w:r>`;
  }).join('');
}

/**
 * Создание XML для ссылки (внешней или внутренней)
 */
function buildLinkRun(text, url, context) {
  const textElement = buildTextElement(text);

  // Внутренняя ссылка (anchor)
  if (url.startsWith('#')) {
    const anchor = url.substring(1);
    return `<w:hyperlink w:anchor="${escapeXml(anchor)}"><w:r><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr>${textElement}</w:r></w:hyperlink>`;
  }

  // Внешняя ссылка
  if (context.addHyperlink && isValidUrl(url)) {
    const rId = context.addHyperlink(url);
    return `<w:hyperlink r:id="${rId}"><w:r><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr>${textElement}</w:r></w:hyperlink>`;
  }

  // Fallback - просто текст со стилем ссылки
  return `<w:r><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr>${textElement}</w:r>`;
}

/**
 * Парсинг Markdown сценария
 */
function parseScenarioMarkdown(scenarioText) {
  const lines = scenarioText.split('\n');
  const result = [];
  let currentList = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Проверка на начало Markdown таблицы
    if (trimmed.startsWith('|')) {
      if (currentList) {
        result.push(currentList);
        currentList = null;
      }

      const parsed = parseMarkdownTable(lines, i);
      if (parsed) {
        result.push(parsed.table);
        i = parsed.endIndex + 1;
        continue;
      }
    }

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
      i++;
      continue;
    }

    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      if (!currentList || currentList.type !== 'numbered') {
        if (currentList) result.push(currentList);
        currentList = { type: 'numbered', items: [] };
      }
      currentList.items.push(numberedMatch[2]);
      i++;
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (!currentList || currentList.type !== 'bullet') {
        if (currentList) result.push(currentList);
        currentList = { type: 'bullet', items: [] };
      }
      currentList.items.push(bulletMatch[1]);
      i++;
      continue;
    }

    if (currentList) {
      result.push(currentList);
      currentList = null;
    }
    result.push({ type: 'text', content: trimmed });
    i++;
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
      const runs = processTextFormatting(item.content, context);
      result.push(`<w:p>${runs}</w:p>`);
    }
    else if (item.type === 'numbered') {
      item.items.forEach((text) => {
        const runs = processTextFormatting(text, context);
        result.push(`<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${styles.numberingIds.decimal}"/></w:numPr></w:pPr>${runs}</w:p>`);
      });
    }
    else if (item.type === 'bullet') {
      item.items.forEach(text => {
        const runs = processTextFormatting(text, context);
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
    else if (item.type === 'table') {
      // Генерируем вложенную таблицу
      const nestedTable = buildNestedTable(item.rows, styles, context);
      result.push(nestedTable);
    }
  }

  return result.length > 0 ? result.join('') : '<w:p/>';
}

/**
 * Генерация вложенной таблицы из Markdown
 */
function buildNestedTable(rows, styles, context = {}) {
  if (!rows || rows.length === 0) return '';

  const tableRows = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = [];

    for (const cellText of row) {
      // Обрабатываем <br> как переводы строк
      const paragraphs = cellText.split('<br>').map(text => {
        const runs = processTextFormatting(text.trim(), context);
        return `<w:p>${runs}</w:p>`;
      }).join('');

      cells.push(buildTableCell(paragraphs));
    }

    tableRows.push(buildTableRow(cells));
  }

  return buildTable(tableRows, { nested: true });
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
  const funcRuns = processTextFormatting(funcDescription || '', context);

  // Если есть ID, добавляем закладку внутрь первого параграфа (а не отдельным параграфом)
  let bookmarkStart = '';
  let bookmarkEnd = '';
  if (id && context.nextBookmarkId) {
    const bookmarkId = context.nextBookmarkId();
    bookmarkStart = `<w:bookmarkStart w:id="${bookmarkId}" w:name="${id}"/>`;
    bookmarkEnd = `<w:bookmarkEnd w:id="${bookmarkId}"/>`;
  }

  // Закладка вставляется внутрь параграфа первой ячейки (не создаёт пустую строку)
  const functionContent = `<w:p>${bookmarkStart}<w:r><w:t>• </w:t></w:r>${funcRuns}${bookmarkEnd}</w:p>`;

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
  
  const table = buildTable(rows, {
    columnWidths: [col1, col2],
    borders: true,
    borderColor: styles.colors.tableBorder
  });

  return table;
}

module.exports = {
  buildFunctionTable,
  buildScenarioContent,
  parseScenarioMarkdown,
  processTextFormatting
};
