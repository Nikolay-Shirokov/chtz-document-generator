/**
 * MetadataRecognizer - распознавание метаданных и истории из таблиц DOCX
 * Извлекает данные из таблиц в начале документа
 */

class MetadataRecognizer {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Извлекает метаданные из элементов документа
   * @param {Array<Element>} elements - все элементы документа
   * @returns {{metadata: Object, history: Array, relatedDocs: Array, metadataIndices: Array}}
   */
  recognize(elements) {
    // Ищем таблицы метаданных в начале документа (до первого заголовка)
    const metadataTables = this.findMetadataTables(elements);

    const metadata = this.extractMetadata(metadataTables.main);
    const history = this.extractHistory(metadataTables.history);
    const relatedDocs = this.extractRelatedDocs(metadataTables.related);

    return {
      metadata,
      history,
      relatedDocs,
      metadataIndices: metadataTables.indices
    };
  }

  /**
   * Находит таблицы метаданных в начале документа
   */
  findMetadataTables(elements) {
    const result = {
      main: null,      // Основная таблица метаданных
      history: null,   // Таблица истории изменений
      related: null,   // Таблица связанных документов
      indices: []      // Индексы всех таблиц метаданных
    };

    // Ищем таблицы до первого заголовка
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];

      // Останавливаемся на первом заголовке
      if (el.type === 'paragraph' && el.isHeading && el.headingLevel === 1) {
        break;
      }

      if (el.type === 'table' && el.rows && el.rows.length > 0) {
        const firstCell = el.rows[0]?.cells?.[0]?.text?.toLowerCase() || '';

        // Определяем тип таблицы по первой ячейке
        if (firstCell.includes('общее описание')) {
          result.main = el;
          result.indices.push(i);
        } else if (firstCell.includes('версия') && el.rows[0].cells.length >= 3) {
          // Таблица истории: "Версия | Дата | Комментарий | Автор"
          result.history = el;
          result.indices.push(i);
        } else if (firstCell.includes('название документа') || firstCell.includes('связанные документы')) {
          result.related = el;
          result.indices.push(i);
        }
      }
    }

    return result;
  }

  /**
   * Извлекает основные метаданные
   */
  extractMetadata(table) {
    if (!table || !table.rows) {
      return this.getDefaultMetadata();
    }

    const metadata = this.getDefaultMetadata();

    for (const row of table.rows) {
      if (!row.cells || row.cells.length < 2) continue;

      const label = row.cells[0].text.toLowerCase().trim();
      const value = row.cells[1].text.trim();

      // Краткое название
      if (label.includes('краткое название')) {
        metadata.shortName = value;
      }

      // Консультант
      if (label.includes('консультант')) {
        metadata.consultant.name = value;
        // Email может быть в 4-й ячейке (если есть)
        if (row.cells.length >= 4) {
          metadata.consultant.email = row.cells[3].text.trim();
        }
      }

      // Организация
      if (label.includes('организации заказчика')) {
        metadata.organization = value;
      }

      // ИТ-решения
      if (label.includes('ит-решений') || label.includes('ит-решение')) {
        metadata.itSolutions = this.parseList(value);
      }

      // ИТ-системы
      if (label.includes('ит-систем') || label.includes('ит-система')) {
        metadata.itSystems = this.parseList(value);
      }

      // КТ
      if (label.includes('данных кт')) {
        metadata.processKT = this.parseYesNo(value);
      }

      // ПДн
      if (label.includes('данных пдн')) {
        metadata.processPDn = this.parseYesNo(value);
      }

      // Дата создания
      if (label.includes('дата создания')) {
        metadata.createdDate = value || this.formatDate(new Date());
      }
    }

    return metadata;
  }

  /**
   * Извлекает историю изменений
   */
  extractHistory(table) {
    if (!table || !table.rows || table.rows.length < 2) {
      return this.getDefaultHistory();
    }

    const history = [];

    // Пропускаем заголовок (первая строка)
    for (let i = 1; i < table.rows.length; i++) {
      const row = table.rows[i];
      if (!row.cells || row.cells.length < 3) continue;

      history.push({
        version: row.cells[0]?.text?.trim() || '',
        date: row.cells[1]?.text?.trim() || '',
        comment: row.cells[2]?.text?.trim() || '',
        author: row.cells[3]?.text?.trim() || ''
      });
    }

    return history.length > 0 ? history : this.getDefaultHistory();
  }

  /**
   * Извлекает связанные документы
   */
  extractRelatedDocs(table) {
    if (!table || !table.rows || table.rows.length < 2) {
      return [];
    }

    const docs = [];

    // Пропускаем заголовок
    for (let i = 1; i < table.rows.length; i++) {
      const row = table.rows[i];
      if (!row.cells || row.cells.length < 2) continue;

      docs.push({
        name: row.cells[0]?.text?.trim() || '',
        version: row.cells[1]?.text?.trim() || '',
        date: row.cells[2]?.text?.trim() || ''
      });
    }

    return docs;
  }

  /**
   * Парсит список значений (через запятую или перенос строки)
   */
  parseList(text) {
    if (!text) return [];

    return text
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Парсит Да/Нет в boolean
   */
  parseYesNo(text) {
    const lower = text.toLowerCase().trim();
    return lower === 'да' || lower === 'yes';
  }

  /**
   * Возвращает метаданные по умолчанию
   */
  getDefaultMetadata() {
    return {
      shortName: '',
      consultant: { name: '', email: '' },
      organization: '',
      itSolutions: [],
      itSystems: [],
      processKT: false,
      processPDn: false,
      createdDate: this.formatDate(new Date())
    };
  }

  /**
   * Возвращает историю по умолчанию
   */
  getDefaultHistory() {
    return [{
      version: '1.0',
      date: this.formatDate(new Date()),
      comment: 'Конвертировано из DOCX',
      author: ''
    }];
  }

  /**
   * Форматирует дату в формат DD.MM.YYYY
   */
  formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }
}

module.exports = { MetadataRecognizer };
