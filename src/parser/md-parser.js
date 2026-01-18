/**
 * Markdown Parser - парсинг Markdown в AST
 */

const { processDirective, isDirective } = require('./directives');

// Динамический импорт ES модулей
let unified, remarkParse, remarkGfm, remarkDirective;

async function loadModules() {
  if (!unified) {
    const unifiedModule = await import('unified');
    unified = unifiedModule.unified;
    remarkParse = (await import('remark-parse')).default;
    remarkGfm = (await import('remark-gfm')).default;
    remarkDirective = (await import('remark-directive')).default;
  }
}

/**
 * Создаёт парсер Markdown
 * @returns {Object} unified processor
 */
async function createParser() {
  await loadModules();
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective);
}

/**
 * Рекурсивно обходит AST и обрабатывает директивы
 * @param {Object} node - AST узел
 * @returns {Object} Обработанный узел
 */
function processAstNode(node) {
  // Обработка директив
  if (isDirective(node)) {
    const processed = processDirective(node);
    return {
      ...node,
      directiveData: processed
    };
  }
  
  // Рекурсивная обработка дочерних узлов
  if (node.children) {
    node.children = node.children.map(child => processAstNode(child));
  }
  
  return node;
}

/**
 * Извлекает изображения из AST и обновляет узлы с атрибутами
 * @param {Object} ast - AST дерево
 * @returns {Array} Массив объектов {url, alt, title, attributes}
 */
function extractImages(ast) {
  const images = [];
  
  function walk(node, siblings = [], index = 0) {
    if (node.type === 'image') {
      let url = node.url;
      let attributes = {};
      
      // Способ 1: Атрибуты внутри URL - ![alt](path.png{width="70%"})
      const attrMatch = url.match(/^(.+?)\{(.+?)\}$/);
      if (attrMatch) {
        url = attrMatch[1];
        const attrStr = attrMatch[2];
        const attrRegex = /(\w+)="([^"]+)"/g;
        let match;
        while ((match = attrRegex.exec(attrStr)) !== null) {
          attributes[match[1]] = match[2];
        }
        // Обновляем URL в узле (убираем атрибуты)
        node.url = url;
      }
      
      // Способ 2: Атрибуты после изображения - ![alt](path.png){width="70%"}
      // Проверяем следующий sibling
      if (siblings && index < siblings.length - 1) {
        const nextSibling = siblings[index + 1];
        if (nextSibling && nextSibling.type === 'text') {
          const siblingMatch = nextSibling.value.match(/^\{(.+?)\}/);
          if (siblingMatch) {
            const attrStr = siblingMatch[1];
            const attrRegex = /(\w+)="([^"]+)"/g;
            let match;
            while ((match = attrRegex.exec(attrStr)) !== null) {
              attributes[match[1]] = match[2];
            }
            // Очищаем атрибуты из текста
            nextSibling.value = nextSibling.value.replace(/^\{.+?\}/, '');
          }
        }
      }
      
      // ВАЖНО: Сохраняем атрибуты в AST узле для использования в билдере
      node.imageAttributes = attributes;
      
      images.push({
        url,
        alt: node.alt || '',
        title: node.title || '',
        attributes
      });
    }
    
    if (node.children) {
      node.children.forEach((child, i) => walk(child, node.children, i));
    }
  }
  
  walk(ast);
  return images;
}

/**
 * Извлекает внешние ссылки из AST
 * @param {Object} ast - AST дерево
 * @returns {Array} Массив объектов {url, text}
 */
function extractLinks(ast) {
  const links = [];
  
  function walk(node) {
    if (node.type === 'link') {
      // Только внешние ссылки (начинаются с http)
      if (node.url && node.url.startsWith('http')) {
        let text = '';
        if (node.children) {
          text = node.children
            .filter(c => c.type === 'text')
            .map(c => c.value)
            .join('');
        }
        
        links.push({
          url: node.url,
          text: text || node.url
        });
      }
    }
    
    if (node.children) {
      node.children.forEach(child => walk(child));
    }
  }
  
  walk(ast);
  return links;
}

/**
 * Извлекает структуру заголовков
 * @param {Object} ast - AST дерево
 * @returns {Array} Массив объектов {level, text, id}
 */
function extractHeadings(ast) {
  const headings = [];
  let counter = 0;
  
  function walk(node) {
    if (node.type === 'heading') {
      let text = '';
      if (node.children) {
        text = node.children
          .filter(c => c.type === 'text')
          .map(c => c.value)
          .join('');
      }
      
      // Генерируем ID из текста заголовка
      const id = text
        .toLowerCase()
        .replace(/[^\w\sа-яё-]/gi, '')
        .replace(/\s+/g, '-')
        .substring(0, 50) || `heading-${counter++}`;
      
      headings.push({
        level: node.depth,
        text,
        id
      });
    }
    
    if (node.children) {
      node.children.forEach(child => walk(child));
    }
  }
  
  walk(ast);
  return headings;
}

/**
 * Парсит Markdown контент
 * @param {string} markdown - Markdown текст
 * @returns {Object} { ast, images, links, headings }
 */
async function parseMarkdown(markdown) {
  const parser = await createParser();
  
  // Парсинг в AST
  const ast = parser.parse(markdown);
  
  // ВАЖНО: Сначала извлекаем изображения и устанавливаем imageAttributes
  // чтобы они были доступны при обработке директив
  const images = extractImages(ast);
  
  // Обработка директив (после установки imageAttributes)
  const processedAst = processAstNode(ast);
  
  // Извлечение остальных метаданных
  const links = extractLinks(processedAst);
  const headings = extractHeadings(processedAst);
  
  return {
    ast: processedAst,
    images,  // Используем результат первого вызова
    links,
    headings
  };
}

/**
 * Получает текст узла (рекурсивно)
 * @param {Object} node - AST узел
 * @returns {string} Текст
 */
function getNodeText(node) {
  if (!node) return '';
  
  if (node.type === 'text') {
    return node.value;
  }
  
  if (node.children) {
    return node.children.map(getNodeText).join('');
  }
  
  return '';
}

module.exports = {
  createParser,
  parseMarkdown,
  processAstNode,
  extractImages,
  extractLinks,
  extractHeadings,
  getNodeText
};
