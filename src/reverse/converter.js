/**
 * ReverseConverter - главный класс обратного конвертера
 * Координирует процесс DOCX → Markdown
 */

const { DocxReader } = require('./reader/docx-reader');
const { RecognizerPipeline } = require('./recognizers');
const { MdBuilder } = require('./builder/md-builder');
const { DocumentValidator } = require('./validator');

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
    this.validator = new DocumentValidator(this.options);

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

      // 3. Валидация структуры
      this.log('Валидация структуры документа...');
      const validation = this.validator.validate(recognized);

      // Добавляем предупреждения
      this.warnings.push(...validation.warnings);

      // В strict mode ошибки валидации приводят к остановке
      if (!validation.valid && this.options.strict) {
        const errorMessage = 'Валидация документа не прошла:\n' +
          validation.errors.map(e => `  ❌ [${e.code}] ${e.message}`).join('\n');
        throw new Error(errorMessage);
      }

      // Если есть ошибки, но не strict mode - добавляем их как предупреждения
      if (validation.errors.length > 0 && !this.options.strict) {
        this.warnings.push(...validation.errors);
      }

      // 4. Генерируем Markdown
      this.log('Генерация Markdown...');
      const markdown = this.builder.build(recognized);

      return {
        success: true,
        markdown,
        metadata: recognized.metadata,
        history: recognized.history,
        relatedDocs: recognized.relatedDocs,
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
   * @param {Object} options - опции сравнения
   * @param {boolean} options.colored - цветной вывод
   * @param {boolean} options.contextLines - количество контекстных строк (по умолчанию 3)
   * @param {boolean} options.stats - показывать статистику
   * @returns {string|Object} diff в unified формате или объект с diff и статистикой
   */
  diff(original, converted, options = {}) {
    const Diff = require('diff');
    const {
      colored = false,
      contextLines = 3,
      stats = false
    } = options;

    // Используем unified diff для лучшего алгоритма
    const diff = Diff.createPatch(
      'document.md',
      original,
      converted,
      'Оригинал',
      'Конвертированный',
      { context: contextLines }
    );

    // Подсчёт статистики
    const changes = Diff.diffLines(original, converted);
    const statistics = {
      linesAdded: 0,
      linesRemoved: 0,
      linesChanged: 0,
      identical: changes.length === 1 && !changes[0].added && !changes[0].removed
    };

    for (const change of changes) {
      if (change.added) {
        statistics.linesAdded += change.count;
      } else if (change.removed) {
        statistics.linesRemoved += change.count;
      }
    }

    statistics.linesChanged = statistics.linesAdded + statistics.linesRemoved;

    // Если документы идентичны
    if (statistics.identical) {
      return stats
        ? { diff: 'Документы идентичны ✓', stats: statistics }
        : 'Документы идентичны ✓';
    }

    // Цветной вывод (если поддерживается)
    let output = diff;
    if (colored) {
      try {
        const chalk = require('chalk');
        const lines = diff.split('\n');
        output = lines.map(line => {
          if (line.startsWith('+') && !line.startsWith('+++')) {
            return chalk.green(line);
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            return chalk.red(line);
          } else if (line.startsWith('@@')) {
            return chalk.cyan(line);
          }
          return line;
        }).join('\n');
      } catch (err) {
        // chalk не доступен, возвращаем обычный вывод
      }
    }

    if (stats) {
      return { diff: output, stats: statistics };
    }

    return output;
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
