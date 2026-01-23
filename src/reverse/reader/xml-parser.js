/**
 * XmlParser - парсинг XML в объект JavaScript
 * Простой парсер для OOXML документов
 */

class XmlParser {
  constructor(options = {}) {
    this.options = {
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      ...options
    };
  }

  /**
   * Парсит XML строку в объект
   * @param {string} xml - XML строка
   * @returns {Object} распарсенный объект
   */
  parse(xml) {
    // Удаляем XML декларацию и комментарии
    xml = xml.replace(/<\?xml[^?]*\?>/gi, '');
    xml = xml.replace(/<!--[\s\S]*?-->/g, '');
    xml = xml.trim();

    return this.parseElement(xml, 0).element;
  }

  /**
   * Парсит элемент начиная с позиции
   * @returns {{element: Object, endPos: number}}
   */
  parseElement(xml, startPos) {
    // Пропускаем пробелы
    while (startPos < xml.length && /\s/.test(xml[startPos])) {
      startPos++;
    }

    if (startPos >= xml.length || xml[startPos] !== '<') {
      return { element: null, endPos: startPos };
    }

    // Находим тег
    const tagEnd = xml.indexOf('>', startPos);
    if (tagEnd === -1) {
      return { element: null, endPos: xml.length };
    }

    const tagContent = xml.substring(startPos + 1, tagEnd);

    // Самозакрывающийся тег
    if (tagContent.endsWith('/')) {
      const tagParts = tagContent.slice(0, -1).trim();
      const { tagName, attributes } = this.parseTagContent(tagParts);

      const result = {};
      result[tagName] = Object.keys(attributes).length > 0 ? { ...attributes } : '';
      return { element: result, endPos: tagEnd + 1 };
    }

    // Обычный тег
    const { tagName, attributes } = this.parseTagContent(tagContent);
    const contentStart = tagEnd + 1;

    // Находим закрывающий тег
    const { content, endPos } = this.findClosingTagContent(xml, tagName, contentStart);

    // Парсим содержимое
    const children = this.parseContent(content);

    // Объединяем атрибуты и детей
    const elementContent = { ...attributes, ...children };

    const result = {};
    result[tagName] = Object.keys(elementContent).length > 0 ? elementContent : '';

    return { element: result, endPos };
  }

  /**
   * Парсит имя тега и атрибуты
   */
  parseTagContent(tagContent) {
    const spaceIndex = tagContent.search(/\s/);
    let tagName, attrStr;

    if (spaceIndex === -1) {
      tagName = tagContent;
      attrStr = '';
    } else {
      tagName = tagContent.substring(0, spaceIndex);
      attrStr = tagContent.substring(spaceIndex);
    }

    const attributes = this.parseAttributes(attrStr);
    return { tagName, attributes };
  }

  /**
   * Парсит атрибуты тега
   */
  parseAttributes(attrStr) {
    const attrs = {};
    const regex = /([^\s=]+)="([^"]*)"/g;
    let match;

    while ((match = regex.exec(attrStr)) !== null) {
      const attrName = this.options.attributeNamePrefix + match[1];
      attrs[attrName] = match[2];
    }

    return attrs;
  }

  /**
   * Находит закрывающий тег и возвращает содержимое
   */
  findClosingTagContent(xml, tagName, startPos) {
    let depth = 1;
    let pos = startPos;
    const closeTag = `</${tagName}>`;
    const openTagStart = `<${tagName}`;

    while (pos < xml.length && depth > 0) {
      // Ищем следующий значимый тег
      const nextOpen = xml.indexOf(openTagStart, pos);
      const nextClose = xml.indexOf(closeTag, pos);

      if (nextClose === -1) {
        // Нет закрывающего тега - ошибка
        break;
      }

      if (nextOpen !== -1 && nextOpen < nextClose) {
        // Нашли открывающий тег раньше закрывающего
        // Проверяем, что это действительно открывающий тег (не другой тег с таким префиксом)
        const afterTagName = xml[nextOpen + openTagStart.length];
        if (afterTagName === '>' || afterTagName === ' ' || afterTagName === '/') {
          // Проверяем, не самозакрывающийся ли это тег
          const tagEnd = xml.indexOf('>', nextOpen);
          if (tagEnd !== -1 && xml[tagEnd - 1] !== '/') {
            depth++;
          }
        }
        pos = nextOpen + openTagStart.length;
      } else {
        // Закрывающий тег раньше
        depth--;
        if (depth === 0) {
          const content = xml.substring(startPos, nextClose);
          return { content, endPos: nextClose + closeTag.length };
        }
        pos = nextClose + closeTag.length;
      }
    }

    // Не нашли закрывающий тег
    return { content: xml.substring(startPos), endPos: xml.length };
  }

  /**
   * Парсит содержимое (дочерние элементы и текст)
   */
  parseContent(content) {
    const result = {};
    const childrenOrder = []; // Сохраняем порядок элементов
    let pos = 0;

    while (pos < content.length) {
      // Пропускаем пробелы
      while (pos < content.length && /\s/.test(content[pos])) {
        pos++;
      }

      if (pos >= content.length) break;

      if (content[pos] === '<') {
        // Элемент
        const { element, endPos } = this.parseElement(content, pos);
        if (element) {
          // Добавляем элемент к результату
          for (const [key, value] of Object.entries(element)) {
            this.addChild(result, key, value);
            // Сохраняем в упорядоченный массив
            childrenOrder.push({ [key]: value });
          }
        }
        pos = endPos;
      } else {
        // Текст
        const textEnd = content.indexOf('<', pos);
        const text = content.substring(pos, textEnd === -1 ? content.length : textEnd).trim();
        if (text) {
          result['#text'] = this.decodeXml(text);
        }
        pos = textEnd === -1 ? content.length : textEnd;
      }
    }

    // Добавляем упорядоченный массив детей если есть элементы
    if (childrenOrder.length > 0) {
      result['__children__'] = childrenOrder;
    }

    return result;
  }

  /**
   * Добавляет дочерний элемент
   */
  addChild(parent, key, value) {
    if (parent[key] !== undefined) {
      // Уже есть такой ключ - делаем массив
      if (!Array.isArray(parent[key])) {
        parent[key] = [parent[key]];
      }
      parent[key].push(value);
    } else {
      parent[key] = value;
    }
  }

  /**
   * Декодирует XML entities
   */
  decodeXml(text) {
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }
}

module.exports = { XmlParser };
