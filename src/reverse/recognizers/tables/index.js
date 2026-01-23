/**
 * TableRecognizer - маршрутизатор распознавания таблиц
 * Определяет тип таблицы и направляет к соответствующему распознавателю
 */

const { TermsTableRecognizer } = require('./terms-table');
const { ChangesTableRecognizer } = require('./changes-table');
const { FunctionTableRecognizer } = require('./function-table');

class TableRecognizer {
  constructor(options = {}) {
    this.options = options;
    this.recognizers = [
      new FunctionTableRecognizer(options),
      new TermsTableRecognizer(options),
      new ChangesTableRecognizer(options),
    ];
  }

  /**
   * Распознаёт тип таблицы и возвращает структурированные данные
   * @param {Object} table - таблица из элемента
   * @param {Object} context - контекст (стили, связи и т.д.)
   * @returns {Object} распознанная таблица
   */
  recognize(table, context = {}) {
    // Пробуем каждый распознаватель
    for (const recognizer of this.recognizers) {
      if (recognizer.canRecognize(table)) {
        return recognizer.recognize(table, context);
      }
    }

    // Обычная таблица
    return {
      type: 'table',
      tableType: 'regular',
      rows: table.rows
    };
  }

  /**
   * Определяет тип таблицы без полного распознавания
   * @param {Object} table - таблица
   * @returns {string} тип таблицы
   */
  identifyType(table) {
    for (const recognizer of this.recognizers) {
      if (recognizer.canRecognize(table)) {
        return recognizer.getType();
      }
    }
    return 'regular';
  }
}

module.exports = { TableRecognizer };
