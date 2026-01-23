/**
 * RecognizerPipeline - оркестратор распознавателей
 * Координирует работу всех распознавателей
 */

const { ElementExtractor } = require('./element-extractor');
const { SectionRecognizer } = require('./sections');
const { FormattingRecognizer } = require('./formatting');
const { MetadataRecognizer } = require('./metadata');

class RecognizerPipeline {
  constructor(options = {}) {
    this.options = options;
    this.elementExtractor = new ElementExtractor(options);
    this.sectionRecognizer = new SectionRecognizer(options);
    this.formattingRecognizer = new FormattingRecognizer(options);
    this.metadataRecognizer = new MetadataRecognizer(options);

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

    // 2. Распознаём метаданные и историю из таблиц
    const metadataResult = this.metadataRecognizer.recognize(elements);

    // 3. Фильтруем элементы - убираем таблицы метаданных для SectionRecognizer
    const contentElements = elements.filter((el, i) =>
      !metadataResult.metadataIndices.includes(i)
    );

    // 4. Распознаём разделы (без таблиц метаданных)
    const sections = this.sectionRecognizer.recognize(contentElements, ast);
    this.warnings.push(...this.sectionRecognizer.warnings);

    return {
      metadata: metadataResult.metadata,
      history: metadataResult.history,
      relatedDocs: metadataResult.relatedDocs,
      sections,
      relations: ast.relations || {},
      images: ast.images || [],
      warnings: this.warnings
    };
  }

  /**
   * Добавляет предупреждение
   */
  addWarning(code, message, context = {}) {
    this.warnings.push({ code, message, ...context });
  }
}

module.exports = { RecognizerPipeline };
