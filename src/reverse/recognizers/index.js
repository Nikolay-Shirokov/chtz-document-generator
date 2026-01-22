/**
 * RecognizerPipeline - оркестратор распознавателей
 * Координирует работу всех распознавателей
 */

const { ElementExtractor } = require('./element-extractor');
const { SectionRecognizer } = require('./sections');
const { FormattingRecognizer } = require('./formatting');

class RecognizerPipeline {
  constructor(options = {}) {
    this.options = options;
    this.elementExtractor = new ElementExtractor(options);
    this.sectionRecognizer = new SectionRecognizer(options);
    this.formattingRecognizer = new FormattingRecognizer(options);

    this.warnings = [];
  }

  /**
   * Распознаёт структуру документа из AST
   * @param {DocumentAST} ast - AST документа
   * @returns {RecognizedDocument}
   */
  recognize(ast) {
    this.warnings = [];

    // 1. Извлекаем элементы из body
    const elements = this.elementExtractor.extract(ast.body, ast);

    // 2. Распознаём разделы
    const sections = this.sectionRecognizer.recognize(elements, ast);
    this.warnings.push(...this.sectionRecognizer.warnings);

    // 3. Извлекаем метаданные (пока заглушка)
    const metadata = this.extractMetadata(sections);

    // 4. Извлекаем историю версий (пока заглушка)
    const history = this.extractHistory(sections);

    return {
      metadata,
      history,
      sections,
      warnings: this.warnings
    };
  }

  /**
   * Извлекает метаданные из документа
   * (Заглушка для Phase 1)
   */
  extractMetadata(sections) {
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
   * Извлекает историю версий
   * (Заглушка для Phase 1)
   */
  extractHistory(sections) {
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

  /**
   * Добавляет предупреждение
   */
  addWarning(code, message, context = {}) {
    this.warnings.push({ code, message, ...context });
  }
}

module.exports = { RecognizerPipeline };
