#!/usr/bin/env node

/**
 * CHTZ Reverse CLI
 * Командный интерфейс для конвертации DOCX → Markdown
 */

const { program } = require('commander');
const path = require('path');
const fs = require('fs');

// Динамический импорт chalk (ESM модуль)
let chalk;
async function loadChalk() {
  if (!chalk) {
    try {
      chalk = (await import('chalk')).default;
    } catch {
      // Fallback если chalk не доступен
      chalk = {
        green: (s) => s,
        red: (s) => s,
        yellow: (s) => s,
        blue: (s) => s,
        gray: (s) => s,
        bold: (s) => s
      };
    }
  }
  return chalk;
}

const { ReverseConverter } = require('../src/reverse');

program
  .name('chtz-reverse')
  .description('Конвертер документов ЧТЗ из Word (.docx) в Markdown')
  .version('1.0.0')
  .argument('<input>', 'Путь к DOCX файлу')
  .option('-o, --output <path>', 'Путь для выходного Markdown файла')
  .option('--images-dir <dir>', 'Директория для сохранения изображений', 'images')
  .option('--no-images', 'Не извлекать изображения')
  .option('--diff <original>', 'Сравнить с оригинальным Markdown файлом')
  .option('--strict', 'Строгий режим валидации')
  .option('-v, --verbose', 'Подробный вывод')
  .action(async (input, options) => {
    const c = await loadChalk();

    // Проверяем существование входного файла
    const inputPath = path.resolve(input);

    if (!fs.existsSync(inputPath)) {
      console.error(c.red(`❌ Файл не найден: ${inputPath}`));
      process.exit(1);
    }

    // Проверяем расширение
    if (!inputPath.toLowerCase().endsWith('.docx')) {
      console.error(c.red(`❌ Ожидается файл с расширением .docx`));
      process.exit(1);
    }

    console.log(c.blue('🔄 Запуск обратного конвертера ЧТЗ...'));
    console.log('');

    try {
      // Создаём конвертер
      const converter = new ReverseConverter({
        extractImages: options.images !== false,
        imagesDir: options.imagesDir,
        strict: options.strict,
        verbose: options.verbose
      });

      // Конвертируем
      const result = await converter.convert(inputPath);

      if (!result.success) {
        console.error(c.red('═══════════════════════════════════════'));
        console.error(c.red('❌ Ошибка конвертации'));
        console.error(c.red('═══════════════════════════════════════'));
        console.error('');
        console.error(c.red(result.error));
        if (options.verbose && result.stack) {
          console.error('');
          console.error(c.gray(result.stack));
        }
        process.exit(1);
      }

      // Определяем выходной файл
      const outputPath = options.output
        ? path.resolve(options.output)
        : inputPath.replace(/\.docx$/i, '.md');

      // Сохраняем Markdown
      fs.writeFileSync(outputPath, result.markdown, 'utf-8');

      // Сохраняем изображения
      if (options.images !== false && result.images && result.images.length > 0) {
        const imagesDir = path.join(path.dirname(outputPath), options.imagesDir);
        await converter.saveImages(result.images, imagesDir);
        console.log(c.gray(`   Изображений сохранено: ${result.images.length}`));
      }

      // Режим сравнения
      if (options.diff) {
        const originalPath = path.resolve(options.diff);
        if (fs.existsSync(originalPath)) {
          const original = fs.readFileSync(originalPath, 'utf-8');
          const diff = converter.diff(original, result.markdown);
          console.log('');
          console.log(c.yellow('Различия с оригиналом:'));
          console.log(diff);
        } else {
          console.warn(c.yellow(`⚠ Файл для сравнения не найден: ${originalPath}`));
        }
      }

      // Выводим предупреждения
      if (result.warnings && result.warnings.length > 0) {
        console.log('');
        console.log(c.yellow(`⚠ Предупреждения: ${result.warnings.length}`));
        if (options.verbose) {
          for (const warning of result.warnings) {
            console.log(c.yellow(`   - ${warning.message || warning}`));
          }
        }
      }

      console.log('');
      console.log(c.green('═══════════════════════════════════════'));
      console.log(c.green('✅ Конвертация завершена!'));
      console.log(c.green('═══════════════════════════════════════'));
      console.log('');
      console.log(`📄 Файл: ${c.bold(outputPath)}`);
      console.log('');
      console.log(c.gray('Статистика:'));
      console.log(c.gray(`   Разделов: ${result.stats?.sections || 0}`));
      console.log(c.gray(`   Изображений: ${result.stats?.images || 0}`));

    } catch (error) {
      console.error(c.red('═══════════════════════════════════════'));
      console.error(c.red('❌ Непредвиденная ошибка'));
      console.error(c.red('═══════════════════════════════════════'));
      console.error('');
      console.error(c.red(error.message));
      if (options.verbose) {
        console.error('');
        console.error(c.gray(error.stack));
      }
      process.exit(1);
    }
  });

program.parse();
