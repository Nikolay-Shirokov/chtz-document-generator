/**
 * CHTZ Generator - главный модуль
 * Генерация документов ЧТЗ из Markdown в Word
 */

const fs = require('fs');
const path = require('path');
const { parseDocument } = require('./parser');
const { buildDocument } = require('./builders');
const { assembleDocx, createAssemblyContext } = require('./assembler');
const styles = require('./styles/gpn-styles');

/**
 * Генерация документа ЧТЗ
 * @param {Object} options - Опции генерации
 * @param {string} options.inputPath - Путь к Markdown файлу
 * @param {string} options.outputPath - Путь к выходному docx файлу
 * @param {string} options.templatePath - Путь к шаблону (опционально)
 * @param {string} options.imagesDir - Директория с изображениями (опционально)
 * @param {boolean} options.verbose - Подробный вывод
 * @returns {Object} Результат генерации
 */
async function generate(options) {
  const {
    inputPath,
    outputPath,
    templatePath,
    imagesDir,
    verbose = false
  } = options;
  
  const log = verbose ? console.log.bind(console) : () => {};
  
  try {
    // 1. Читаем входной файл
    log(`📖 Чтение файла: ${inputPath}`);
    const fileContent = fs.readFileSync(inputPath, 'utf-8');
    
    // 2. Определяем директорию изображений
    const resolvedImagesDir = imagesDir || path.dirname(inputPath);
    log(`🖼️  Директория изображений: ${resolvedImagesDir}`);
    
    // 3. Парсим документ
    log('🔍 Парсинг Markdown...');
    const parsedData = await parseDocument(fileContent);
    log(`   ✓ Метаданные загружены`);
    log(`   ✓ Найдено заголовков: ${parsedData.headings.length}`);
    log(`   ✓ Найдено изображений: ${parsedData.images.length}`);
    log(`   ✓ Найдено ссылок: ${parsedData.links.length}`);
    
    // 4. Создаём контекст сборки
    log('🔧 Подготовка контекста...');
    const context = createAssemblyContext({ imagesDir: resolvedImagesDir });
    
    // 5. Строим document.xml
    log('📝 Генерация document.xml...');
    const documentXml = buildDocument(parsedData, styles, context);
    
    // 6. Определяем путь к шаблону
    const resolvedTemplatePath = templatePath || path.join(__dirname, '..', 'templates', 'gpn-template.docx');
    
    if (!fs.existsSync(resolvedTemplatePath)) {
      throw new Error(`Шаблон не найден: ${resolvedTemplatePath}`);
    }
    log(`📋 Шаблон: ${resolvedTemplatePath}`);
    
    // 7. Определяем выходной путь
    const resolvedOutputPath = outputPath || inputPath.replace(/\.md$/, '.docx');
    
    // 8. Собираем docx
    log('📦 Сборка docx...');
    const result = await assembleDocx({
      templatePath: resolvedTemplatePath,
      outputPath: resolvedOutputPath,
      documentXml,
      hyperlinks: context.getHyperlinks(),
      images: context.getImages(),
      imagesDir: resolvedImagesDir
    });
    
    log(`✅ Документ создан: ${resolvedOutputPath}`);
    
    return {
      success: true,
      outputPath: resolvedOutputPath,
      stats: {
        headings: parsedData.headings.length,
        images: context.getImages().length,
        hyperlinks: context.getHyperlinks().size
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * Валидация входного файла без генерации
 * @param {string} inputPath - Путь к файлу
 * @returns {Object} Результат валидации
 */
async function validate(inputPath) {
  try {
    const fileContent = fs.readFileSync(inputPath, 'utf-8');
    const parsedData = await parseDocument(fileContent);
    
    return {
      valid: true,
      metadata: parsedData.metadata,
      stats: {
        headings: parsedData.headings.length,
        images: parsedData.images.length,
        links: parsedData.links.length
      }
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

module.exports = {
  generate,
  validate,
  styles
};
