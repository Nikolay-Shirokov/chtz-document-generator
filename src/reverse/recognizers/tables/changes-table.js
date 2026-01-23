/**
 * ChangesTableRecognizer - распознавание таблицы изменений
 * Формат: | Как есть | Как будет |
 */

class ChangesTableRecognizer {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Возвращает тип распознавателя
   */
  getType() {
    return 'changes';
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

    const hasAsIsHeader = headers.some(h =>
      h.includes('как есть') || h.includes('текущее') || h.includes('было')
    );
    const hasToBeHeader = headers.some(h =>
      h.includes('как будет') || h.includes('новое') || h.includes('стало') || h.includes('планируется')
    );

    return hasAsIsHeader && hasToBeHeader;
  }

  /**
   * Распознаёт таблицу изменений
   * @param {Object} table - таблица
   * @param {Object} context - контекст
   * @returns {Object} распознанная таблица
   */
  recognize(table, context = {}) {
    const changes = [];

    // Пропускаем заголовок (первую строку)
    for (let i = 1; i < table.rows.length; i++) {
      const row = table.rows[i];
      if (row.cells && row.cells.length >= 2) {
        const asIs = this.cleanText(row.cells[0].text);
        const toBe = this.cleanText(row.cells[1].text);

        if (asIs || toBe) {
          changes.push({ asIs, toBe });
        }
      }
    }

    return {
      type: 'table',
      tableType: 'changes',
      changes
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

module.exports = { ChangesTableRecognizer };
