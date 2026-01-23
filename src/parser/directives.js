/**
 * Directive Processor - обработка специальных блоков :::directive
 */

/**
 * Типы поддерживаемых директив
 */
const DIRECTIVE_TYPES = {
  TERMS: 'terms',
  CHANGES_TABLE: 'changes-table',
  FUNCTION_TABLE: 'function-table',
  NOTE: 'note',
  EMPTY_SECTION: 'empty-section'
};

/**
 * Парсинг атрибутов директивы
 * Формат: {#id attr1="value1" attr2="value2"}
 * @param {Object} node - AST узел директивы
 * @returns {Object} Атрибуты
 */
function parseDirectiveAttributes(node) {
  const attrs = {};
  
  // ID из hProperties или attributes
  if (node.data && node.data.hProperties && node.data.hProperties.id) {
    attrs.id = node.data.hProperties.id;
  }
  
  // Атрибуты из node.attributes
  if (node.attributes) {
    Object.assign(attrs, node.attributes);
  }
  
  return attrs;
}

/**
 * Парсинг YAML-подобного содержимого директивы function-table
 * @param {string} content - Содержимое директивы
 * @returns {Object} Распарсенные данные
 */
function parseFunctionTableContent(content) {
  const result = {
    function: '',
    task: '',
    taskUrl: '',
    scenario: ''
  };

  // Нормализуем переводы строк (Windows \r\n -> \n)
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Разбиваем на строки и парсим ключ: значение
  const lines = normalizedContent.split('\n');
  let currentKey = null;
  let currentValue = [];
  let inMultiline = false;
  
  for (const line of lines) {
    // Проверяем начало многострочного значения (key: |)
    const multilineMatch = line.match(/^(\w+):\s*\|?\s*$/);
    if (multilineMatch) {
      // Сохраняем предыдущее значение
      if (currentKey) {
        result[currentKey] = currentValue.join('\n').trim();
      }
      currentKey = multilineMatch[1];
      currentValue = [];
      inMultiline = true;
      continue;
    }
    
    // Проверяем простое значение (key: value)
    const simpleMatch = line.match(/^(\w+):\s*(.+)$/);
    if (simpleMatch && !inMultiline) {
      // Сохраняем предыдущее значение
      if (currentKey) {
        result[currentKey] = currentValue.join('\n').trim();
      }
      result[simpleMatch[1]] = simpleMatch[2].trim();
      currentKey = null;
      currentValue = [];
      continue;
    }
    
    // Добавляем строку к текущему многострочному значению
    if (inMultiline && currentKey) {
      currentValue.push(line);
    }
  }
  
  // Сохраняем последнее значение
  if (currentKey) {
    result[currentKey] = currentValue.join('\n').trim();
  }
  
  return result;
}

/**
 * Извлечение текстового содержимого из AST узлов
 * @param {Array} children - Дочерние узлы
 * @returns {string} Текст
 */
function extractText(children) {
  if (!children) return '';
  
  return children.map(child => {
    if (child.type === 'text') {
      return child.value;
    }
    if (child.children) {
      return extractText(child.children);
    }
    return '';
  }).join('');
}

/**
 * Извлечение таблицы из дочерних узлов
 * @param {Array} children - Дочерние узлы
 * @returns {Object|null} Таблица {headers: [], rows: [[]]}
 */
function extractTable(children) {
  if (!children) return null;
  
  for (const child of children) {
    if (child.type === 'table') {
      const rows = [];
      let headers = [];
      
      for (let i = 0; i < child.children.length; i++) {
        const row = child.children[i];
        if (row.type === 'tableRow') {
          const cells = row.children
            .filter(cell => cell.type === 'tableCell')
            .map(cell => extractText(cell.children));
          
          if (i === 0) {
            headers = cells;
          } else {
            rows.push(cells);
          }
        }
      }
      
      return { headers, rows };
    }
  }
  
  return null;
}

/**
 * Обработка директивы terms
 * @param {Object} node - AST узел
 * @returns {Object} Структура данных
 */
function processTermsDirective(node) {
  const table = extractTable(node.children);
  
  return {
    type: DIRECTIVE_TYPES.TERMS,
    table: table || { headers: ['Термин', 'Определение'], rows: [] }
  };
}

/**
 * Обработка директивы changes-table
 * @param {Object} node - AST узел
 * @returns {Object} Структура данных
 */
function processChangesTableDirective(node) {
  const table = extractTable(node.children);
  
  return {
    type: DIRECTIVE_TYPES.CHANGES_TABLE,
    table: table || { headers: ['Как есть', 'Как будет'], rows: [] }
  };
}

/**
 * Рекурсивное извлечение текста из AST узла с сохранением Markdown-форматирования
 * @param {Object} node - AST узел
 * @param {number} depth - Глубина вложенности для списков
 * @returns {string} Текст с Markdown-разметкой
 */
function extractMarkdownText(node, depth = 0) {
  if (!node) return '';
  
  // Текстовый узел
  if (node.type === 'text') {
    return node.value || '';
  }
  
  // Изображение - возвращаем Markdown синтаксис
  if (node.type === 'image') {
    let url = node.url || '';
    const alt = node.alt || '';
    // Добавляем атрибуты если есть
    if (node.imageAttributes && Object.keys(node.imageAttributes).length > 0) {
      const attrs = Object.entries(node.imageAttributes)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
      url = `${url}{${attrs}}`;
    }
    return `\n![${alt}](${url})\n`;
  }
  
  // Жирный текст
  if (node.type === 'strong') {
    const inner = node.children ? node.children.map(c => extractMarkdownText(c, depth)).join('') : '';
    return `**${inner}**`;
  }
  
  // Курсив
  if (node.type === 'emphasis') {
    const inner = node.children ? node.children.map(c => extractMarkdownText(c, depth)).join('') : '';
    return `*${inner}*`;
  }
  
  // Параграф - обрабатываем с учётом соседних узлов
  if (node.type === 'paragraph') {
    if (!node.children) return '\n';
    
    const results = [];
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      
      // Если это текст начинающийся с {, и предыдущий был image - пропускаем атрибуты
      if (child.type === 'text' && i > 0 && node.children[i-1].type === 'image') {
        const value = child.value || '';
        // Убираем атрибуты {width="..."} в начале
        const cleaned = value.replace(/^\{[^}]+\}/, '');
        if (cleaned.trim()) {
          results.push(cleaned);
        }
        continue;
      }
      
      results.push(extractMarkdownText(child, depth));
    }
    return results.join('') + '\n';
  }
  
  // Список (маркированный или нумерованный)
  if (node.type === 'list') {
    const items = node.children || [];
    const indent = '  '.repeat(depth);
    return items.map((item, index) => {
      const itemText = extractMarkdownText(item, depth + 1);
      if (node.ordered) {
        return `${indent}${index + 1}. ${itemText}`;
      } else {
        return `${indent}- ${itemText}`;
      }
    }).join('\n') + '\n';
  }
  
  // Элемент списка
  if (node.type === 'listItem') {
    if (node.children) {
      return node.children.map(c => extractMarkdownText(c, depth)).join('').trim();
    }
    return '';
  }

  // Таблица - конвертируем в Markdown синтаксис
  if (node.type === 'table') {
    const indent = '  '.repeat(depth);
    const rows = [];

    if (node.children) {
      for (let rowIndex = 0; rowIndex < node.children.length; rowIndex++) {
        const rowNode = node.children[rowIndex];
        if (rowNode.type === 'tableRow' && rowNode.children) {
          const cells = rowNode.children
            .filter(cell => cell.type === 'tableCell')
            .map(cell => {
              // Извлекаем текст из ячейки
              const cellText = cell.children
                ? cell.children.map(c => extractMarkdownText(c, depth)).join('').trim()
                : '';
              // Заменяем переводы строк на <br> и экранируем pipe
              return cellText.replace(/\n/g, '<br>').replace(/\|/g, '\\|');
            });

          // Формируем строку таблицы
          rows.push(`${indent}| ${cells.join(' | ')} |`);

          // После первой строки добавляем разделитель
          if (rowIndex === 0) {
            const separator = cells.map(() => '---').join(' | ');
            rows.push(`${indent}| ${separator} |`);
          }
        }
      }
    }

    return '\n' + rows.join('\n') + '\n';
  }

  // Строка таблицы - обрабатывается в table выше
  if (node.type === 'tableRow') {
    // Не должно вызываться напрямую, но на всякий случай
    return '';
  }

  // Ячейка таблицы - обрабатывается в table выше
  if (node.type === 'tableCell') {
    // Не должно вызываться напрямую, но на всякий случай
    return '';
  }

  // Код (code block) - может содержать Markdown таблицу
  if (node.type === 'code') {
    // Проверяем, является ли это Markdown таблицей
    const codeContent = node.value || '';
    const lines = codeContent.split('\n').filter(l => l.trim()); // Убираем пустые строки

    // Проверяем, начинается ли с pipe (Markdown таблица)
    if (lines.length > 0 && lines[0].trim().startsWith('|')) {
      // Это Markdown таблица, сохраняем как есть с отступом
      const indent = '  '.repeat(depth);
      const tableLines = lines.map(l => indent + l.trim()).join('\n');
      // Добавляем newline только в начале если это первый блок (depth == 0)
      return '\n' + tableLines + '\n';
    }

    // Обычный код - не должно быть в function-table, но на всякий случай
    return '';
  }

  // Для остальных узлов с детьми - рекурсивно обрабатываем
  if (node.children) {
    return node.children.map(c => extractMarkdownText(c, depth)).join('');
  }

  return '';
}

/**
 * Обработка директивы function-table
 * @param {Object} node - AST узел
 * @returns {Object} Структура данных
 */
function processFunctionTableDirective(node) {
  const attrs = parseDirectiveAttributes(node);

  // Извлекаем текстовое содержимое с сохранением Markdown-форматирования
  let textContent = '';
  if (node.children) {
    for (const child of node.children) {
      textContent += extractMarkdownText(child);
    }
  }
  
  // Парсим YAML-подобный контент
  const data = parseFunctionTableContent(textContent);
  
  return {
    type: DIRECTIVE_TYPES.FUNCTION_TABLE,
    id: attrs.id || null,
    function: data.function,
    task: data.task,
    taskUrl: data.taskUrl,
    scenario: data.scenario,
    // Сохраняем оригинальные children для обработки Markdown в scenario
    scenarioChildren: node.children
  };
}

/**
 * Обработка директивы note
 * @param {Object} node - AST узел
 * @returns {Object} Структура данных
 */
function processNoteDirective(node) {
  const attrs = parseDirectiveAttributes(node);
  
  // Извлекаем текст с Markdown-форматированием
  let textContent = '';
  if (node.children) {
    for (const child of node.children) {
      textContent += extractMarkdownText(child);
    }
  }
  
  return {
    type: DIRECTIVE_TYPES.NOTE,
    noteType: attrs.type || 'info', // info, warning, danger
    text: textContent.trim(),
    children: node.children
  };
}

/**
 * Обработка директивы empty-section
 * @param {Object} node - AST узел
 * @returns {Object} Структура данных
 */
function processEmptySectionDirective(node) {
  return {
    type: DIRECTIVE_TYPES.EMPTY_SECTION,
    text: extractText(node.children)
  };
}

/**
 * Основная функция обработки директивы
 * @param {Object} node - AST узел директивы (containerDirective)
 * @returns {Object} Обработанная структура данных
 */
function processDirective(node) {
  const name = node.name;
  
  switch (name) {
    case 'terms':
      return processTermsDirective(node);
    
    case 'changes-table':
      return processChangesTableDirective(node);
    
    case 'function-table':
      return processFunctionTableDirective(node);
    
    case 'note':
      return processNoteDirective(node);
    
    case 'empty-section':
      return processEmptySectionDirective(node);
    
    default:
      // Неизвестная директива - возвращаем как есть
      return {
        type: 'unknown',
        name: name,
        children: node.children
      };
  }
}

/**
 * Проверка, является ли узел директивой
 * @param {Object} node - AST узел
 * @returns {boolean}
 */
function isDirective(node) {
  return node.type === 'containerDirective' || 
         node.type === 'leafDirective' ||
         node.type === 'textDirective';
}

module.exports = {
  DIRECTIVE_TYPES,
  processDirective,
  isDirective,
  parseDirectiveAttributes,
  parseFunctionTableContent,
  extractText,
  extractTable,
  extractMarkdownText
};
