/**
 * SectionRecognizer - распознавание структуры разделов документа
 */

class SectionRecognizer {
  /**
   * Известные разделы ЧТЗ
   */
  static KNOWN_SECTIONS = [
    { pattern: /^1\.\s*Термины/i, id: 'terms', title: '1. Термины и определения' },
    { pattern: /^2\.\s*Исходные данные/i, id: 'background', title: '2. Исходные данные задания' },
    { pattern: /^3\.\s*Изменение функционала/i, id: 'changes', title: '3. Изменение функционала системы' },
    { pattern: /^4\.\s*Описание изменений в ИТ/i, id: 'it-changes', title: '4. Описание изменений в ИТ-системе' },
    { pattern: /^5\.\s*Описание изменений в интеграционных/i, id: 'integrations', title: '5. Описание изменений в интеграционных механизмах' },
    { pattern: /^6\.\s*Описание изменений.*ПДн/i, id: 'pdn', title: '6. Описание изменений, состава обрабатываемых ПДн' },
    { pattern: /^7\.\s*Входные формы/i, id: 'input-forms', title: '7. Входные формы' },
    { pattern: /^8\.\s*Выходные формы/i, id: 'output-forms', title: '8. Выходные формы' },
    { pattern: /^9\.\s*Описание изменений в ролевой/i, id: 'roles', title: '9. Описание изменений в ролевой модели' },
    { pattern: /^10\.\s*Приложения/i, id: 'appendix', title: '10. Приложения' },
  ];

  constructor(options = {}) {
    this.options = options;
    this.warnings = [];
  }

  /**
   * Распознаёт разделы документа
   * @param {Array<Element>} elements - извлечённые элементы
   * @param {DocumentAST} ast - AST для доступа к стилям
   * @returns {Array<Section>}
   */
  recognize(elements, ast) {
    this.warnings = [];
    const sections = [];
    let currentSection = null;
    let contentBuffer = [];

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];

      // Проверяем, является ли элемент заголовком
      if (element.type === 'paragraph' && element.isHeading && element.headingLevel > 0) {
        const level = element.headingLevel;
        const text = element.text.trim();

        if (level === 1) {
          // Заголовок первого уровня - новый раздел
          if (currentSection) {
            currentSection.content = [...contentBuffer];
            sections.push(currentSection);
            contentBuffer = [];
          }

          currentSection = this.createSection(text, level);
        } else if (currentSection) {
          // Подзаголовок - добавляем как вложенный контент
          contentBuffer.push({
            type: 'heading',
            level,
            text
          });
        } else {
          // Заголовок до первого раздела
          contentBuffer.push({
            type: 'heading',
            level,
            text
          });
        }
      } else if (currentSection) {
        // Обычный контент
        contentBuffer.push(this.processElement(element));
      } else {
        // Контент до первого раздела (титульная страница)
        // Пока игнорируем
      }
    }

    // Добавляем последний раздел
    if (currentSection) {
      currentSection.content = [...contentBuffer];
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Создаёт объект раздела
   */
  createSection(text, level) {
    const knownSection = this.identifySection(text);

    return {
      id: knownSection ? knownSection.id : this.generateId(text),
      title: text,
      level,
      knownType: knownSection ? knownSection.id : null,
      content: [],
      subsections: []
    };
  }

  /**
   * Идентифицирует известный раздел по тексту
   */
  identifySection(text) {
    for (const section of SectionRecognizer.KNOWN_SECTIONS) {
      if (section.pattern.test(text)) {
        return section;
      }
    }
    return null;
  }

  /**
   * Генерирует ID для неизвестного раздела
   */
  generateId(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\sа-яё]/gi, '')
      .replace(/\s+/g, '-')
      .substring(0, 30);
  }

  /**
   * Обрабатывает элемент для добавления в контент
   */
  processElement(element) {
    if (element.type === 'paragraph') {
      return this.processParagraph(element);
    }

    if (element.type === 'table') {
      return this.processTable(element);
    }

    return element;
  }

  /**
   * Обрабатывает параграф
   */
  processParagraph(p) {
    // Проверяем, является ли параграф частью списка
    if (p.listInfo) {
      return {
        type: 'list-item',
        level: parseInt(p.listInfo.level, 10),
        text: p.text,
        runs: p.runs
      };
    }

    // Проверяем на пустой раздел
    if (this.isEmptySectionText(p.text)) {
      return {
        type: 'empty-section',
        text: p.text
      };
    }

    return {
      type: 'paragraph',
      text: p.text,
      runs: p.runs
    };
  }

  /**
   * Обрабатывает таблицу
   */
  processTable(table) {
    // Определяем тип таблицы
    const tableType = this.identifyTableType(table);

    return {
      type: 'table',
      tableType,
      rows: table.rows.map(row => ({
        cells: row.cells.map(cell => ({
          text: cell.text,
          paragraphs: cell.paragraphs
        }))
      }))
    };
  }

  /**
   * Определяет тип таблицы
   */
  identifyTableType(table) {
    if (!table.rows || table.rows.length === 0) {
      return 'regular';
    }

    const firstRow = table.rows[0];
    if (!firstRow.cells || firstRow.cells.length === 0) {
      return 'regular';
    }

    // Получаем текст заголовков
    const headers = firstRow.cells.map(c => c.text.toLowerCase().trim());

    // Таблица терминов
    if (headers.length === 2 &&
        headers.some(h => h.includes('термин')) &&
        headers.some(h => h.includes('определение'))) {
      return 'terms';
    }

    // Таблица изменений
    if (headers.length === 2 &&
        headers.some(h => h.includes('как есть')) &&
        headers.some(h => h.includes('как будет'))) {
      return 'changes';
    }

    // Функциональная таблица (по первой ячейке)
    const firstCellText = firstRow.cells[0].text;
    if (firstCellText.match(/[•●]\s*Функция:/i)) {
      return 'function';
    }

    return 'regular';
  }

  /**
   * Проверяет, является ли текст маркером пустого раздела
   */
  isEmptySectionText(text) {
    const normalized = text.toLowerCase().trim();
    const patterns = [
      /не применим/,
      /не требуется/,
      /отсутствуют/,
      /нет изменений/,
      /раздел не применим/
    ];

    return patterns.some(p => p.test(normalized));
  }
}

module.exports = { SectionRecognizer };
