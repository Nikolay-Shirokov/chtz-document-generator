/**
 * Parser Module - объединённый экспорт
 */

const { parseYaml, YamlValidationError, formatValidationError } = require('./yaml-parser');
const { parseMarkdown, getNodeText, extractImages, extractLinks, extractHeadings } = require('./md-parser');
const { processDirective, isDirective, DIRECTIVE_TYPES, extractText, extractTable } = require('./directives');

/**
 * Полный парсинг файла (YAML + Markdown)
 * @param {string} fileContent - Содержимое файла
 * @param {Object} options - Опции
 * @returns {Object} Полностью распарсенные данные
 */
async function parseDocument(fileContent, options = {}) {
  // 1. Парсинг YAML front matter
  const { data: yamlData, content: markdownContent } = parseYaml(fileContent, options);
  
  // 2. Парсинг Markdown
  const { ast, images, links, headings } = await parseMarkdown(markdownContent);
  
  return {
    // Метаданные из YAML
    metadata: yamlData.metadata,
    history: yamlData.history,
    relatedDocs: yamlData.relatedDocs,
    version: yamlData.version,
    type: yamlData.type,
    
    // Контент из Markdown
    ast,
    
    // Извлечённые данные
    images,
    links,
    headings
  };
}

module.exports = {
  // Главная функция
  parseDocument,
  
  // YAML
  parseYaml,
  YamlValidationError,
  formatValidationError,
  
  // Markdown
  parseMarkdown,
  getNodeText,
  extractImages,
  extractLinks,
  extractHeadings,
  
  // Директивы
  processDirective,
  isDirective,
  DIRECTIVE_TYPES,
  extractText,
  extractTable
};
