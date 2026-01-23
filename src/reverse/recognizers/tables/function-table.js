/**
 * FunctionTableRecognizer - распознавание функциональных таблиц
 * Формат: 3 строки × 2 колонки (Функция, Задача, Сценарий)
 */

const { tableToMarkdownIndented } = require('./table-to-markdown');

class FunctionTableRecognizer {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Возвращает тип распознавателя
   */
  getType() {
    return 'function';
  }

  /**
   * Проверяет, может ли распознать таблицу
   * @param {Object} table - таблица
   * @returns {boolean}
   */
  canRecognize(table) {
    if (!table.rows || table.rows.length < 3) {
      return false;
    }

    // Проверяем, что таблица имеет 2 колонки
    const firstRow = table.rows[0];
    if (!firstRow.cells || firstRow.cells.length !== 2) {
      return false;
    }

    // Проверяем метки в первой колонке
    const labels = [
      table.rows[0].cells[0].text.trim().toLowerCase(),
      table.rows[1].cells[0].text.trim().toLowerCase(),
      table.rows[2].cells[0].text.trim().toLowerCase()
    ];

    const hasFunctionLabel = labels[0] === 'функция';
    const hasTaskLabel = labels[1].includes('задач');
    const hasScenarioLabel = labels[2] === 'сценарий';

    return hasFunctionLabel && hasTaskLabel && hasScenarioLabel;
  }

  /**
   * Распознаёт функциональную таблицу
   * @param {Object} table - таблица
   * @param {Object} context - контекст
   * @returns {Object} распознанная таблица
   */
  recognize(table, context = {}) {
    // Извлекаем значения из второй колонки
    const functionText = this.cleanText(table.rows[0].cells[1].text);
    const taskText = this.cleanText(table.rows[1].cells[1].text);

    // Обрабатываем сценарий с возможными вложенными таблицами
    const scenarioCell = table.rows[2].cells[1];
    let scenarioText = scenarioCell.text || '';

    // Если в ячейке сценария есть вложенные таблицы, конвертируем их в Markdown
    if (scenarioCell.tables && scenarioCell.tables.length > 0) {
      // Добавляем текст сценария (если есть)
      let fullScenario = scenarioText.trim();

      // Добавляем пустую строку перед таблицами, если есть текст
      if (fullScenario) {
        fullScenario += '\n';
      }

      // Конвертируем каждую вложенную таблицу в Markdown с отступом
      const nestedTablesMarkdown = scenarioCell.tables.map(nestedTable => {
        return '\n' + tableToMarkdownIndented(nestedTable, 1);
      }).join('\n');

      scenarioText = fullScenario + nestedTablesMarkdown;
    }

    // Извлекаем URL из taskText, если есть
    const urlMatch = taskText.match(/(https?:\/\/\S+)/i);
    const taskUrl = urlMatch ? urlMatch[1] : null;

    // Генерируем ID на основе задачи или функции
    const id = this.generateId(taskText, functionText);

    return {
      type: 'table',
      tableType: 'function',
      id,
      function: functionText,
      task: taskText,
      taskUrl,
      scenario: scenarioText.trim()
    };
  }

  /**
   * Генерирует ID для функциональной таблицы
   */
  generateId(taskText, functionText) {
    // Пытаемся извлечь номер задачи
    const taskMatch = taskText.match(/([A-Z]+-\d+)/i);
    if (taskMatch) {
      return `func-${taskMatch[1].toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    }

    // Генерируем из функции
    const funcWords = functionText
      .toLowerCase()
      .replace(/[^\wа-яё\s]/gi, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 3)
      .join('-');

    return funcWords ? `func-${funcWords}` : 'func';
  }

  /**
   * Очищает текст (удаляет маркеры списка и лишние пробелы)
   */
  cleanText(text) {
    if (!text) return '';

    return text
      .replace(/^[•●\-–—]\s*/, '') // Удаляем маркер в начале
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = { FunctionTableRecognizer };
