/**
 * FunctionTableRecognizer - распознавание функциональных таблиц
 * Формат: 3 строки × 2 колонки (Функция, Задача, Сценарий)
 */

const { tableToMarkdownIndented } = require('./table-to-markdown');
const { FormattingRecognizer } = require('../formatting');

class FunctionTableRecognizer {
  constructor(options = {}) {
    this.options = options;
    this.formatter = new FormattingRecognizer(options);
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
   * @param {Object} context - контекст (relations, images)
   * @returns {Object} распознанная таблица
   */
  recognize(table, context = {}) {
    const relations = context.relations || {};
    const images = context.images || [];

    // Извлекаем значения из второй колонки с учётом форматирования (ссылок, изображений)
    const functionCell = table.rows[0].cells[1];
    const taskCell = table.rows[1].cells[1];

    const functionText = this.cleanText(this.formatCell(functionCell, relations, images));
    const taskText = this.cleanText(this.formatCell(taskCell, relations, images));

    // Обрабатываем сценарий с возможными вложенными таблицами
    const scenarioCell = table.rows[2].cells[1];
    let scenarioText = this.formatCell(scenarioCell, relations, images) || '';

    // Если в ячейке сценария есть вложенные таблицы, конвертируем их в Markdown
    if (scenarioCell.tables && scenarioCell.tables.length > 0) {
      // Добавляем текст сценария (если есть)
      let fullScenario = scenarioText.trim();

      // Добавляем пустую строку перед таблицами, если есть текст
      // В Markdown перед таблицей должна быть пустая строка
      if (fullScenario) {
        fullScenario += '\n\n';  // Две \n создают пустую строку
      }

      // Конвертируем каждую вложенную таблицу в Markdown БЕЗ дополнительного отступа
      // В YAML блоке scenario: | базовый отступ уже есть (2 пробела)
      // Дополнительный отступ превращает таблицу в code block
      const nestedTablesMarkdown = scenarioCell.tables.map(nestedTable => {
        return tableToMarkdownIndented(nestedTable, 0);
      }).join('\n\n'); // Используем \n\n между таблицами

      scenarioText = fullScenario + nestedTablesMarkdown;
    }

    // Извлекаем URL из taskText, если есть
    // URL может быть в формате markdown [text](url) или просто https://...
    let taskUrl = null;
    const mdLinkMatch = taskText.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
    if (mdLinkMatch) {
      taskUrl = mdLinkMatch[2];
    } else {
      const plainUrlMatch = taskText.match(/(https?:\/\/\S+)/i);
      taskUrl = plainUrlMatch ? plainUrlMatch[1] : null;
    }

    // Генерируем ID на основе задачи или функции
    const id = this.generateId(taskText, functionText);

    return {
      type: 'table',
      tableType: 'function',
      id,
      function: functionText,
      task: taskText,
      taskUrl,
      // Убираем пробелы только в начале, сохраняя внутреннюю структуру
      scenario: scenarioText.trimStart()
    };
  }

  /**
   * Генерирует ID для функциональной таблицы
   * Приоритет: название функции (уникальное), затем номер задачи (fallback)
   */
  generateId(taskText, functionText) {
    // Приоритет: генерируем из названия функции (более уникальный ID)
    if (functionText) {
      const funcWords = functionText
        .toLowerCase()
        .replace(/[^\wа-яё\s]/gi, '')
        .split(/\s+/)
        .filter(w => w.length > 3)
        .slice(0, 3)
        .join('-');

      if (funcWords) {
        return `func-${funcWords}`;
      }
    }

    // Fallback: пытаемся извлечь номер задачи
    const taskMatch = taskText.match(/([A-Z]+-\d+)/i);
    if (taskMatch) {
      return `func-${taskMatch[1].toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    }

    return 'func';
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

  /**
   * Форматирует содержимое ячейки с учётом ссылок, изображений и нумерации
   * @param {Object} cell - ячейка таблицы
   * @param {Object} relations - связи документа
   * @param {Array} images - массив изображений
   * @returns {string} отформатированный текст
   */
  formatCell(cell, relations, images) {
    if (!cell) return '';

    // Если есть параграфы с runs - форматируем их
    if (cell.paragraphs && cell.paragraphs.length > 0) {
      const formattedParagraphs = cell.paragraphs.map(p => {
        let text = '';
        if (p.runs && p.runs.length > 0) {
          text = this.formatter.formatRuns(p.runs, relations, images);
        } else {
          text = p.text || '';
        }

        // Обработка нумерованных/маркированных списков
        if (p.listInfo && p.listInfo.numId) {
          const level = parseInt(p.listInfo.level, 10) || 0;
          const indent = '  '.repeat(level);

          // В Markdown используем "1." для всех пунктов списка
          // Markdown процессоры автоматически нумеруют пункты при рендеринге
          // Это стандартная практика, которая делает списки более устойчивыми к редактированию
          return `${indent}1. ${text}`;
        }

        return text;
      });
      return formattedParagraphs.join('\n');
    }

    // Fallback на простой текст
    return cell.text || '';
  }
}

module.exports = { FunctionTableRecognizer };
