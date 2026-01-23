/**
 * TermsTableRecognizer - распознавание таблицы терминов
 * Формат: | Термин | Определение |
 */

class TermsTableRecognizer {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Возвращает тип распознавателя
   */
  getType() {
    return 'terms';
  }

  /**
   * Проверяет, может ли распознать таблицу
   * @param {Object} table - таблица
   * @returns {boolean}
   */
  canRecognize(table) {
    if (!table.rows || table.rows.length < 2) {
      return false;
    }

    const firstRow = table.rows[0];
    if (!firstRow.cells || firstRow.cells.length !== 2) {
      return false;
    }

    // Проверяем заголовки
    const headers = firstRow.cells.map(c =>
      (c.text || '').toLowerCase().trim()
    );

    const hasTermHeader = headers.some(h =>
      h.includes('термин') || h.includes('сокращение') || h.includes('аббревиатура')
    );
    const hasDefHeader = headers.some(h =>
      h.includes('определение') || h.includes('расшифровка') || h.includes('описание')
    );

    return hasTermHeader && hasDefHeader;
  }

  /**
   * Распознаёт таблицу терминов
   * @param {Object} table - таблица
   * @param {Object} context - контекст
   * @returns {Object} распознанная таблица
   */
  recognize(table, context = {}) {
    const terms = [];

    // Пропускаем заголовок (первую строку)
    for (let i = 1; i < table.rows.length; i++) {
      const row = table.rows[i];
      if (row.cells && row.cells.length >= 2) {
        const term = this.cleanText(row.cells[0].text);
        const definition = this.cleanText(row.cells[1].text);

        if (term || definition) {
          terms.push({ term, definition });
        }
      }
    }

    return {
      type: 'table',
      tableType: 'terms',
      terms
    };
  }

  /**
   * Очищает текст
   */
  cleanText(text) {
    if (!text) return '';
    return text
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = { TermsTableRecognizer };
