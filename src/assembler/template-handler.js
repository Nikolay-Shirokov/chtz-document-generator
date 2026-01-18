/**
 * Template Handler - работа с docx-шаблоном
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

/**
 * Распаковка шаблона во временную директорию
 * @param {string} templatePath - Путь к шаблону
 * @param {string} outputDir - Директория для распаковки
 * @returns {Object} Пути к ключевым файлам
 */
function unpackTemplate(templatePath, outputDir) {
  const zip = new AdmZip(templatePath);
  zip.extractAllTo(outputDir, true);
  
  return {
    documentPath: path.join(outputDir, 'word', 'document.xml'),
    relsPath: path.join(outputDir, 'word', '_rels', 'document.xml.rels'),
    stylesPath: path.join(outputDir, 'word', 'styles.xml'),
    numberingPath: path.join(outputDir, 'word', 'numbering.xml'),
    mediaDir: path.join(outputDir, 'word', 'media'),
    contentTypesPath: path.join(outputDir, '[Content_Types].xml')
  };
}

/**
 * Упаковка директории в docx
 * @param {string} sourceDir - Директория с файлами
 * @param {string} outputPath - Путь к выходному файлу
 */
function packToDocx(sourceDir, outputPath) {
  const zip = new AdmZip();
  
  // Рекурсивно добавляем все файлы
  function addDirectory(dirPath, zipPath = '') {
    const entries = fs.readdirSync(dirPath);
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const entryZipPath = zipPath ? `${zipPath}/${entry}` : entry;
      
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        addDirectory(fullPath, entryZipPath);
      } else {
        const content = fs.readFileSync(fullPath);
        zip.addFile(entryZipPath, content);
      }
    }
  }
  
  addDirectory(sourceDir);
  zip.writeZip(outputPath);
}

/**
 * Обновление [Content_Types].xml для новых изображений
 * @param {string} contentTypesPath - Путь к файлу
 * @param {Array} imageExtensions - Расширения добавленных изображений
 */
function updateContentTypes(contentTypesPath, imageExtensions) {
  let content = fs.readFileSync(contentTypesPath, 'utf-8');
  
  const extensionTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp'
  };
  
  for (const ext of imageExtensions) {
    const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
    const contentType = extensionTypes[normalizedExt.toLowerCase()];
    
    if (contentType) {
      const extWithoutDot = normalizedExt.substring(1);
      // Проверяем, есть ли уже такое расширение
      if (!content.includes(`Extension="${extWithoutDot}"`)) {
        // Добавляем перед закрывающим тегом
        const newDefault = `<Default Extension="${extWithoutDot}" ContentType="${contentType}"/>`;
        content = content.replace('</Types>', `${newDefault}\n</Types>`);
      }
    }
  }
  
  fs.writeFileSync(contentTypesPath, content);
}

/**
 * Чтение relationships из шаблона
 * @param {string} relsPath - Путь к файлу rels
 * @returns {string} Содержимое файла
 */
function readRelationships(relsPath) {
  return fs.readFileSync(relsPath, 'utf-8');
}

/**
 * Запись relationships
 * @param {string} relsPath - Путь к файлу
 * @param {string} content - XML содержимое
 */
function writeRelationships(relsPath, content) {
  fs.writeFileSync(relsPath, content);
}

/**
 * Запись document.xml
 * @param {string} documentPath - Путь к файлу
 * @param {string} content - XML содержимое
 */
function writeDocument(documentPath, content) {
  fs.writeFileSync(documentPath, content);
}

/**
 * Копирование изображения в media директорию
 * @param {string} sourcePath - Путь к исходному файлу
 * @param {string} mediaDir - Директория media
 * @param {string} targetName - Имя целевого файла
 */
function copyImageToMedia(sourcePath, mediaDir, targetName) {
  // Создаём директорию если не существует
  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
  }
  
  const targetPath = path.join(mediaDir, targetName);
  fs.copyFileSync(sourcePath, targetPath);
}

/**
 * Получение списка существующих изображений в media
 * @param {string} mediaDir - Директория media
 * @returns {Array} Список имён файлов
 */
function getExistingImages(mediaDir) {
  if (!fs.existsSync(mediaDir)) {
    return [];
  }
  
  return fs.readdirSync(mediaDir).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.bmp'].includes(ext);
  });
}

module.exports = {
  unpackTemplate,
  packToDocx,
  updateContentTypes,
  readRelationships,
  writeRelationships,
  writeDocument,
  copyImageToMedia,
  getExistingImages
};
