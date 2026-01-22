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

    // Пропускаем заголовок (первую строку)
    for (let i = 1; i < table.rows.length; i++) {
      const row = table.rows[i];
      const term = this.escapeTableCell(row.cells[0]?.text || '');
      const definition = this.escapeTableCell(row.cells[1]?.text || '');
      lines.push(`| ${term} | ${definition} |`);
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

    // Пропускаем заголовок (первую строку)
    for (let i = 1; i < table.rows.length; i++) {
      const row = table.rows[i];
      const asIs = this.escapeTableCell(row.cells[0]?.text || '');
      const toBe = this.escapeTableCell(row.cells[1]?.text || '');
      lines.push(`| ${asIs} | ${toBe} |`);
    }

    lines.push(':::');
    return lines.join('\n');
  }

  /**
   * Строит функциональную таблицу
   */
  buildFunctionTable(table) {
    const lines = [];

    // Извлекаем данные из таблицы
    const data = this.extractFunctionTableData(table);

    // Генерируем ID
    const id = data.task ? `func-${data.task.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : '';

    lines.push(`:::function-table${id ? `{#${id}}` : ''}`);
    lines.push(`function: ${data.function}`);

    if (data.task) {
      lines.push(`task: ${data.task}`);
    }

    if (data.taskUrl) {
      lines.push(`taskUrl: ${data.taskUrl}`);
    }

    lines.push('scenario: |');

    // Добавляем сценарий с отступами
    const scenarioLines = data.scenario.split('\n');
    for (const line of scenarioLines) {
      lines.push(`  ${line}`);
    }

    lines.push(':::');
    return lines.join('\n');
  }

  /**
   * Извлекает данные из функциональной таблицы
   */
  extractFunctionTableData(table) {
    const data = {
      function: '',
      task: '',
      taskUrl: '',
      scenario: ''
    };

    if (!table.rows || table.rows.length === 0) {
      return data;
    }

    // Первая строка содержит метаданные
    const headerRow = table.rows[0];
    if (headerRow.cells && headerRow.cells[0]) {
      const headerText = headerRow.cells[0].text;

      // Извлекаем функцию
      const funcMatch = headerText.match(/Функция:\s*(.+?)(?:\n|$)/i);
      if (funcMatch) {
        data.function = funcMatch[1].trim();
      }

      // Извлекаем задачу
      const taskMatch = headerText.match(/Задача:\s*(\S+)/i);
      if (taskMatch) {
        data.task = taskMatch[1].trim();
      }

      // Извлекаем URL
      const urlMatch = headerText.match(/(https?:\/\/\S+)/i);
      if (urlMatch) {
        data.taskUrl = urlMatch[1].trim();
      }
    }

    // Вторая строка содержит сценарий
    if (table.rows.length > 1) {
      const scenarioRow = table.rows[1];
      if (scenarioRow.cells && scenarioRow.cells[0]) {
        let scenario = scenarioRow.cells[0].text;

        // Удаляем префикс "Сценарий:"
        scenario = scenario.replace(/^Сценарий:\s*/i, '');

        data.scenario = scenario.trim();
      }
    }

    return data;
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
