/**
 * Утилита для конвертации таблицы в Markdown формат
 */

/**
 * Конвертирует таблицу в Markdown
 * @param {Object} table - таблица из extractTable
 * @param {Object} options - опции
 * @returns {string} Markdown таблица
 */
function tableToMarkdown(table, options = {}) {
  const { indent = 0 } = options;
  const indentStr = '  '.repeat(indent);

  if (!table || !table.rows || table.rows.length === 0) {
    return '';
  }

  const lines = [];

  // Обработка строк таблицы
  for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
    const row = table.rows[rowIndex];
    if (!row.cells || row.cells.length === 0) continue;

    // Собираем ячейки
    const cells = row.cells.map(cell => {
      let cellText = '';

      // Текст из параграфов
      if (cell.paragraphs && cell.paragraphs.length > 0) {
        cellText = cell.paragraphs
          .map(p => p.text || '')
          .join('<br>'); // Используем <br> для многострочных ячеек
      }

      // Вложенные таблицы (рекурсивно конвертируем)
      if (cell.tables && cell.tables.length > 0) {
        const nestedTables = cell.tables.map(t =>
          tableToMarkdown(t, { indent: 0 })
        ).join('\n\n');

        // Если есть и текст, и таблицы - объединяем
        if (cellText && nestedTables) {
          cellText = cellText + '<br><br>' + nestedTables.replace(/\n/g, '<br>');
        } else if (nestedTables) {
          cellText = nestedTables.replace(/\n/g, '<br>');
        }
      }

      // Экранируем pipe символы
      return escapeTableCell(cellText);
    });

    // Формируем строку таблицы
    const rowLine = `${indentStr}| ${cells.join(' | ')} |`;
    lines.push(rowLine);

    // После первой строки (заголовок) добавляем разделитель
    if (rowIndex === 0) {
      const separator = cells.map(() => '---').join(' | ');
      lines.push(`${indentStr}| ${separator} |`);
    }
  }

  return lines.join('\n');
}

/**
 * Экранирует специальные символы в ячейке таблицы
 * @param {string} text - текст ячейки
 * @returns {string} экранированный текст
 */
function escapeTableCell(text) {
  if (!text) return '';

  return text
    .replace(/\|/g, '\\|')  // Экранируем pipe
    .replace(/\n/g, '<br>') // Заменяем переводы строк на <br>
    .trim();
}

/**
 * Конвертирует таблицу в Markdown с отступами (для scenario)
 * @param {Object} table - таблица
 * @param {number} baseIndent - базовый отступ (для scenario: | это 1)
 * @returns {string} Markdown таблица с отступами
 */
function tableToMarkdownIndented(table, baseIndent = 1) {
  if (!table || !table.rows || table.rows.length === 0) {
    return '';
  }

  const lines = [];
  const indentStr = '  '.repeat(baseIndent);

  // Обработка строк таблицы
  for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
    const row = table.rows[rowIndex];
    if (!row.cells || row.cells.length === 0) continue;

    // Собираем ячейки
    const cells = row.cells.map(cell => {
      let cellText = '';

      // Текст из параграфов
      if (cell.paragraphs && cell.paragraphs.length > 0) {
        cellText = cell.paragraphs
          .map(p => p.text || '')
          .join('<br>');
      }

      // Вложенные таблицы внутри вложенных таблиц (да, такое возможно!)
      if (cell.tables && cell.tables.length > 0) {
        const nestedTables = cell.tables.map(t =>
          tableToMarkdown(t, { indent: 0 })
        ).join('\n\n');

        if (cellText && nestedTables) {
          cellText = cellText + '<br><br>' + nestedTables.replace(/\n/g, '<br>');
        } else if (nestedTables) {
          cellText = nestedTables.replace(/\n/g, '<br>');
        }
      }

      return escapeTableCell(cellText);
    });

    // Формируем строку таблицы с отступом
    lines.push(`${indentStr}| ${cells.join(' | ')} |`);

    // После первой строки добавляем разделитель
    if (rowIndex === 0) {
      const separator = cells.map(() => '---').join(' | ');
      lines.push(`${indentStr}| ${separator} |`);
    }
  }

  // Добавляем пустую строку после таблицы (стандарт Markdown)
  return lines.join('\n') + '\n';
}

module.exports = {
  tableToMarkdown,
  tableToMarkdownIndented,
  escapeTableCell
};
