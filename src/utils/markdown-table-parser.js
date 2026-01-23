/**
 * Утилита для парсинга Markdown таблиц
 */

/**
 * Проверяет, является ли строка разделителем таблицы (| --- | --- |)
 */
function isTableSeparator(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    return false;
  }

  // Проверяем, что строка состоит из | и дефисов
  const content = trimmed.slice(1, -1);
  const cells = content.split('|').map(c => c.trim());

  return cells.every(cell => /^-+$/.test(cell));
}

/**
 * Парсит строку Markdown таблицы
 */
function parseTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    return null;
  }

  const content = trimmed.slice(1, -1);
  const cells = content.split('|').map(c => c.trim());

  return cells;
}

/**
 * Парсит Markdown таблицу из массива строк
 * @param {Array<string>} lines - строки текста
 * @param {number} startIndex - индекс начала таблицы
 * @returns {{table: Object, endIndex: number} | null}
 */
function parseMarkdownTable(lines, startIndex) {
  if (startIndex >= lines.length) return null;

  // Первая строка должна быть строкой таблицы
  const headerCells = parseTableRow(lines[startIndex]);
  if (!headerCells) return null;

  // Находим разделитель, пропуская пустые строки
  let separatorIndex = startIndex + 1;
  while (separatorIndex < lines.length && !lines[separatorIndex].trim()) {
    separatorIndex++;
  }

  // Проверяем что следующая непустая строка - разделитель
  if (separatorIndex >= lines.length || !isTableSeparator(lines[separatorIndex])) {
    return null;
  }

  // Собираем строки данных (начинаем после разделителя)
  const rows = [headerCells];
  let currentIndex = separatorIndex + 1;

  while (currentIndex < lines.length) {
    const cells = parseTableRow(lines[currentIndex]);
    if (!cells) break;

    rows.push(cells);
    currentIndex++;
  }

  return {
    table: {
      type: 'table',
      rows: rows
    },
    endIndex: currentIndex - 1
  };
}

/**
 * Парсит текст с возможными Markdown таблицами
 * @param {string} text - текст для парсинга
 * @returns {Array} массив элементов (текст, таблицы, etc)
 */
function parseTextWithTables(text) {
  const lines = text.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Проверяем, начинается ли таблица
    if (trimmed.startsWith('|')) {
      const parsed = parseMarkdownTable(lines, i);

      if (parsed) {
        result.push(parsed.table);
        i = parsed.endIndex + 1;
        continue;
      }
    }

    // Обычная строка текста
    if (trimmed) {
      result.push({ type: 'text', content: trimmed });
    }
    i++;
  }

  return result;
}

module.exports = {
  isTableSeparator,
  parseTableRow,
  parseMarkdownTable,
  parseTextWithTables
};
