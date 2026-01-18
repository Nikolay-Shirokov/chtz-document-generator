#!/usr/bin/env node

/**
 * CHTZ Generator CLI
 * Командный интерфейс для генерации документов ЧТЗ
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

const { generate, validate } = require('../src/index');

program
  .name('chtz-generate')
  .description('Генератор документов ЧТЗ из Markdown в Word')
  .version('1.0.0')
  .argument('<input>', 'Путь к Markdown файлу')
  .option('-o, --output <path>', 'Путь для выходного файла')
  .option('-t, --template <path>', 'Путь к шаблону docx')
  .option('-i, --images <dir>', 'Директория с изображениями')
  .option('-v, --verbose', 'Подробный вывод')
  .option('--validate-only', 'Только валидация без генерации')
  .action(async (input, options) => {
    const c = await loadChalk();
    
    // Проверяем существование входного файла
    const inputPath = path.resolve(input);
    
    if (!fs.existsSync(inputPath)) {
      console.error(c.red(`❌ Файл не найден: ${inputPath}`));
      process.exit(1);
    }
    
    // Режим валидации
    if (options.validateOnly) {
      console.log(c.blue('🔍 Валидация файла...'));
      const result = await validate(inputPath);
      
      if (result.valid) {
        console.log(c.green('✅ Файл валиден'));
        console.log(c.gray(`   Заголовков: ${result.stats.headings}`));
        console.log(c.gray(`   Изображений: ${result.stats.images}`));
        console.log(c.gray(`   Ссылок: ${result.stats.links}`));
      } else {
        console.error(c.red(`❌ Ошибка валидации: ${result.error}`));
        process.exit(1);
      }
      return;
    }
    
    // Генерация
    console.log(c.blue('🚀 Запуск генератора ЧТЗ...'));
    console.log('');
    
    const result = await generate({
      inputPath,
      outputPath: options.output ? path.resolve(options.output) : undefined,
      templatePath: options.template ? path.resolve(options.template) : undefined,
      imagesDir: options.images ? path.resolve(options.images) : undefined,
      verbose: options.verbose
    });
    
    console.log('');
    
    if (result.success) {
      console.log(c.green('═══════════════════════════════════════'));
      console.log(c.green('✅ Документ успешно создан!'));
      console.log(c.green('═══════════════════════════════════════'));
      console.log('');
      console.log(`📄 Файл: ${c.bold(result.outputPath)}`);
      console.log('');
      console.log(c.gray('Статистика:'));
      console.log(c.gray(`   Заголовков: ${result.stats.headings}`));
      console.log(c.gray(`   Изображений: ${result.stats.images}`));
      console.log(c.gray(`   Гиперссылок: ${result.stats.hyperlinks}`));
    } else {
      console.error(c.red('═══════════════════════════════════════'));
      console.error(c.red('❌ Ошибка генерации'));
      console.error(c.red('═══════════════════════════════════════'));
      console.error('');
      console.error(c.red(result.error));
      if (options.verbose && result.stack) {
        console.error('');
        console.error(c.gray(result.stack));
      }
      process.exit(1);
    }
  });

program.parse();
