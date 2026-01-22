/**
 * ReverseConverter - главный класс обратного конвертера
 * Координирует процесс DOCX → Markdown
 */

const { DocxReader } = require('./reader/docx-reader');
const { RecognizerPipeline } = require('./recognizers');
const { MdBuilder } = require('./builder/md-builder');

class ReverseConverter {
  constructor(options = {}) {
    this.options = {
      extractImages: true,
      imagesDir: 'images',
      strict: false,
      verbose: false,
      ...options
    };

    this.reader = new DocxReader(this.options);
    this.recognizers = new RecognizerPipeline(this.options);
    this.builder = new MdBuilder(this.options);

    this.warnings = [];
  }

  /**
   * Конвертирует DOCX в Markdown
   * @param {string|Buffer} input - путь к файлу или Buffer
   * @returns {Promise<ConversionResult>}
   */
  async convert(input) {
    this.warnings = [];

    try {
      // 1. Читаем и парсим DOCX
      this.log('Чтение DOCX файла...');
      const ast = await this.reader.read(input);

      // 2. Распознаём структуру
      this.log('Распознавание структуры документа...');
      const recognized = this.recognizers.recognize(ast);
      this.warnings.push(...recognized.warnings);

      // 3. Генерируем Markdown
      this.log('Генерация Markdown...');
      const markdown = this.builder.build(recognized);

      return {
        success: true,
        markdown,
        metadata: recognized.metadata,
        images: ast.images || [],
        warnings: this.warnings,
        stats: {
          sections: recognized.sections.length,
          images: (ast.images || []).length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack,
        warnings: this.warnings
      };
    }
  }

  /**
   * Сохраняет извлечённые изображения
   * @param {Array} images - массив изображений
   * @param {string} outputDir - директория для сохранения
   */
  async saveImages(images, outputDir) {
    const fs = require('fs').promises;
    const path = require('path');

    await fs.mkdir(outputDir, { recursive: true });

    for (const image of images) {
      const outputPath = path.join(outputDir, image.filename);
      await fs.writeFile(outputPath, image.data);
      this.log(`Сохранено изображение: ${outputPath}`);
    }
  }

  /**
   * Сравнивает два Markdown документа
   * @param {string} original - оригинальный Markdown
   * @param {string} converted - конвертированный Markdown
   * @returns {string} diff в unified формате
   */
  diff(original, converted) {
    // Простая реализация diff
    const originalLines = original.split('\n');
    const convertedLines = converted.split('\n');

    const result = [];
    const maxLen = Math.max(originalLines.length, convertedLines.length);

    for (let i = 0; i < maxLen; i++) {
      const origLine = originalLines[i] || '';
      const convLine = convertedLines[i] || '';

      if (origLine !== convLine) {
        if (origLine) result.push(`- ${origLine}`);
        if (convLine) result.push(`+ ${convLine}`);
      }
    }

    return result.length > 0 ? result.join('\n') : 'Документы идентичны';
  }

  /**
   * Добавляет предупреждение
   * @param {string} code - код предупреждения
   * @param {string} message - сообщение
   * @param {Object} context - контекст
   */
  addWarning(code, message, context = {}) {
    this.warnings.push({ code, message, ...context });
  }

  /**
   * Логирование (если verbose)
   */
  log(message) {
    if (this.options.verbose) {
      console.log(`  ${message}`);
    }
  }
}

module.exports = { ReverseConverter };
