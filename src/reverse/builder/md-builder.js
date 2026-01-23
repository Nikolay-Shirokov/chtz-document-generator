/**
 * MdBuilder - генерация Markdown из распознанного документа
 */

const { YamlBuilder } = require('./yaml-builder');
const { FormattingRecognizer } = require('../recognizers/formatting');

class MdBuilder {
  constructor(options = {}) {
    this.options = options;
    this.yamlBuilder = new YamlBuilder();
    this.formatter = new FormattingRecognizer();
  }

  /**
   * Собирает Markdown из распознанного документа
   * @param {RecognizedDocument} doc - распознанный документ
   * @returns {string} Markdown строка
   */
  build(doc) {
    const parts = [];

    // 1. YAML front matter
    parts.push(this.yamlBuilder.build(doc.metadata, doc.history));

    // 2. Разделы
    for (const section of doc.sections) {
      parts.push(this.buildSection(section));
    }

    return parts.join('\n\n');
  }

  /**
   * Строит раздел
   */
  buildSection(section) {
    const parts = [];

    // Заголовок
    const prefix = '#'.repeat(section.level);
    parts.push(`${prefix} ${section.title}`);

    // Контент
    for (const element of section.content) {
      const built = this.buildElement(element);
      if (built) {
        parts.push(built);
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Строит элемент контента
   */
  buildElement(element) {
    switch (element.type) {
      case 'paragraph':
        return this.buildParagraph(element);
      case 'heading':
        return this.buildHeading(element);
      case 'table':
        return this.buildTable(element);
      case 'list-item':
        return this.buildListItem(element);
      case 'empty-section':
        return this.buildEmptySection(element);
      default:
        return null;
    }
  }

  /**
   * Строит параграф
   */
  buildParagraph(p) {
    if (!p.text || !p.text.trim()) {
      return null;
    }

    // Форматируем с учётом runs
    if (p.runs && p.runs.length > 0) {
      return this.formatter.formatRuns(p.runs);
    }

    return p.text;
  }

  /**
   * Строит заголовок
   */
  buildHeading(h) {
    const prefix = '#'.repeat(h.level);
    return `${prefix} ${h.text}`;
  }

  /**
   * Строит таблицу
   */
  buildTable(table) {
    switch (table.tableType) {
      case 'terms':
        return this.buildTermsTable(table);
      case 'changes':
        return this.buildChangesTable(table);
      case 'function':
        return this.buildFunctionTable(table);
      default:
        return this.buildRegularTable(table);
    }
  }

  /**
   * Строит таблицу терминов
   */
  buildTermsTable(table) {
    const lines = [':::terms'];
    lines.push('| Термин | Определение |');
    lines.push('|--------|-------------|');

    // Используем распознанные terms
    if (table.terms && table.terms.length > 0) {
      for (const { term, definition } of table.terms) {
        const termEsc = this.escapeTableCell(term);
        const defEsc = this.escapeTableCell(definition);
        lines.push(`| ${termEsc} | ${defEsc} |`);
      }
    }

    lines.push(':::');
    return lines.join('\n');
  }

  /**
   * Строит таблицу изменений
   */
  buildChangesTable(table) {
    const lines = [':::changes-table'];
    lines.push('| Описание функции «Как есть» | Описание функции «Как будет» |');
    lines.push('|-----------------------------|------------------------------|');

    // Используем распознанные changes
    if (table.changes && table.changes.length > 0) {
      for (const { asIs, toBe } of table.changes) {
        const asIsEsc = this.escapeTableCell(asIs);
        const toBeEsc = this.escapeTableCell(toBe);
        lines.push(`| ${asIsEsc} | ${toBeEsc} |`);
      }
    }

    lines.push(':::');
    return lines.join('\n');
  }

  /**
   * Строит функциональную таблицу
   */
  buildFunctionTable(table) {
    const lines = [];

    // ID уже сгенерирован в распознавателе
    const id = table.id || '';

    lines.push(`:::function-table${id ? `{#${id}}` : ''}`);
    lines.push(`function: ${table.function || ''}`);

    if (table.task) {
      lines.push(`task: ${table.task}`);
    }

    if (table.taskUrl) {
      lines.push(`taskUrl: ${table.taskUrl}`);
    }

    lines.push('scenario: |');

    // Добавляем сценарий с отступами
    const scenario = table.scenario || '';
    const scenarioLines = scenario.split('\n');
    for (const line of scenarioLines) {
      lines.push(`  ${line}`);
    }

    lines.push(':::');
    return lines.join('\n');
  }


  /**
   * Строит обычную таблицу
   */
  buildRegularTable(table) {
    if (!table.rows || table.rows.length === 0) {
      return '';
    }

    const lines = [];

    // Заголовок
    const headerRow = table.rows[0];
    const headers = headerRow.cells.map(c => this.escapeTableCell(c.text));
    lines.push(`| ${headers.join(' | ')} |`);

    // Разделитель
    const separator = headers.map(() => '---').join(' | ');
    lines.push(`| ${separator} |`);

    // Данные
    for (let i = 1; i < table.rows.length; i++) {
      const row = table.rows[i];
      const cells = row.cells.map(c => this.escapeTableCell(c.text));
      lines.push(`| ${cells.join(' | ')} |`);
    }

    return lines.join('\n');
  }

  /**
   * Строит элемент списка
   */
  buildListItem(item) {
    const indent = '  '.repeat(item.level || 0);

    // Определяем тип списка по содержимому
    const text = item.text.trim();
    const isNumbered = this.formatter.isNumberedItem(text);

    if (isNumbered) {
      return `${indent}${text}`;
    }

    return `${indent}- ${this.formatter.stripListMarker(text)}`;
  }

  /**
   * Строит пустой раздел
   */
  buildEmptySection(element) {
    return `:::empty-section\n${element.text}\n:::`;
  }

  /**
   * Экранирует специальные символы в ячейке таблицы
   */
  escapeTableCell(text) {
    if (!text) return '';

    return text
      .replace(/\|/g, '\\|')
      .replace(/\n/g, ' ')
      .trim();
  }
}

module.exports = { MdBuilder };
