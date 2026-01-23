/**
 * DocxReader - чтение и распаковка DOCX файлов
 * Извлекает XML-содержимое и изображения
 */

const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const { XmlParser } = require('./xml-parser');

class DocxReader {
  constructor(options = {}) {
    this.options = options;
    this.xmlParser = new XmlParser();
  }

  /**
   * Читает DOCX файл и возвращает DocumentAST
   * @param {string|Buffer} input - путь к файлу или Buffer
   * @returns {Promise<DocumentAST>}
   */
  async read(input) {
    // Загружаем ZIP
    const zip = this.loadZip(input);

    // Извлекаем основные XML файлы
    const documentXml = this.getFileContent(zip, 'word/document.xml');
    const stylesXml = this.getFileContent(zip, 'word/styles.xml');
    const relsXml = this.getFileContent(zip, 'word/_rels/document.xml.rels');
    const numberingXml = this.getFileContent(zip, 'word/numbering.xml');

    if (!documentXml) {
      throw new Error('Файл не является корректным DOCX: отсутствует word/document.xml');
    }

    // Парсим XML
    const document = this.xmlParser.parse(documentXml);
    const styles = stylesXml ? this.xmlParser.parse(stylesXml) : null;
    const relations = relsXml ? this.parseRelations(relsXml) : {};
    const numbering = numberingXml ? this.xmlParser.parse(numberingXml) : null;

    // Извлекаем изображения
    const images = this.options.extractImages !== false
      ? this.extractImages(zip)
      : [];

    // Извлекаем тело документа
    const body = this.extractBody(document);

    // Парсим стили
    const stylesMap = styles ? this.parseStyles(styles) : {};

    return {
      body,
      styles: stylesMap,
      relations,
      numbering: this.parseNumbering(numbering),
      images,
      rawDocument: document
    };
  }

  /**
   * Загружает ZIP архив
   */
  loadZip(input) {
    if (Buffer.isBuffer(input)) {
      return new AdmZip(input);
    }

    if (typeof input === 'string') {
      if (!fs.existsSync(input)) {
        throw new Error(`Файл не найден: ${input}`);
      }
      return new AdmZip(input);
    }

    throw new Error('Неверный формат входных данных: ожидается путь к файлу или Buffer');
  }

  /**
   * Получает содержимое файла из ZIP
   */
  getFileContent(zip, filePath) {
    const entry = zip.getEntry(filePath);
    if (!entry) {
      return null;
    }
    return entry.getData().toString('utf-8');
  }

  /**
   * Извлекает тело документа из распарсенного XML
   */
  extractBody(document) {
    // Структура: w:document > w:body > [элементы]
    const wDocument = document['w:document'];
    if (!wDocument) {
      throw new Error('Некорректная структура документа: отсутствует w:document');
    }

    const wBody = wDocument['w:body'];
    if (!wBody) {
      throw new Error('Некорректная структура документа: отсутствует w:body');
    }

    // Возвращаем массив элементов тела
    return Array.isArray(wBody) ? wBody : [wBody];
  }

  /**
   * Парсит файл связей (relationships)
   */
  parseRelations(relsXml) {
    const parsed = this.xmlParser.parse(relsXml);
    const relations = {};

    const relationships = parsed['Relationships'];
    if (!relationships || !relationships['Relationship']) {
      return relations;
    }

    const rels = Array.isArray(relationships['Relationship'])
      ? relationships['Relationship']
      : [relationships['Relationship']];

    for (const rel of rels) {
      const id = rel['@_Id'];
      const type = rel['@_Type'] || '';
      const target = rel['@_Target'] || '';

      let relType = 'other';
      if (type.includes('image')) {
        relType = 'image';
      } else if (type.includes('hyperlink')) {
        relType = 'hyperlink';
      }

      relations[id] = {
        type: relType,
        target,
        targetMode: rel['@_TargetMode'] || ''
      };
    }

    return relations;
  }

  /**
   * Парсит стили документа
   */
  parseStyles(stylesDoc) {
    const stylesMap = {};

    const styles = stylesDoc['w:styles'];
    if (!styles || !styles['w:style']) {
      return stylesMap;
    }

    const styleList = Array.isArray(styles['w:style'])
      ? styles['w:style']
      : [styles['w:style']];

    for (const style of styleList) {
      const styleId = style['@_w:styleId'];
      const styleType = style['@_w:type'];

      if (styleId) {
        stylesMap[styleId] = {
          id: styleId,
          type: styleType,
          name: this.getStyleName(style),
          basedOn: this.getBasedOn(style)
        };
      }
    }

    return stylesMap;
  }

  /**
   * Получает имя стиля
   */
  getStyleName(style) {
    const name = style['w:name'];
    return name ? (name['@_w:val'] || '') : '';
  }

  /**
   * Получает базовый стиль
   */
  getBasedOn(style) {
    const basedOn = style['w:basedOn'];
    return basedOn ? (basedOn['@_w:val'] || null) : null;
  }

  /**
   * Парсит настройки нумерации
   */
  parseNumbering(numberingDoc) {
    if (!numberingDoc) return {};

    const numbering = numberingDoc['w:numbering'];
    if (!numbering) return {};

    const result = {
      abstractNum: {},
      num: {}
    };

    // Парсим абстрактные определения нумерации
    if (numbering['w:abstractNum']) {
      const abstracts = Array.isArray(numbering['w:abstractNum'])
        ? numbering['w:abstractNum']
        : [numbering['w:abstractNum']];

      for (const abs of abstracts) {
        const absId = abs['@_w:abstractNumId'];
        if (absId) {
          result.abstractNum[absId] = abs;
        }
      }
    }

    // Парсим конкретные нумерации
    if (numbering['w:num']) {
      const nums = Array.isArray(numbering['w:num'])
        ? numbering['w:num']
        : [numbering['w:num']];

      for (const num of nums) {
        const numId = num['@_w:numId'];
        if (numId) {
          const absRef = num['w:abstractNumId'];
          result.num[numId] = {
            abstractNumId: absRef ? absRef['@_w:val'] : null
          };
        }
      }
    }

    return result;
  }

  /**
   * Извлекает изображения из DOCX
   */
  extractImages(zip) {
    const images = [];
    const entries = zip.getEntries();

    for (const entry of entries) {
      if (entry.entryName.startsWith('word/media/')) {
        const filename = path.basename(entry.entryName);
        const ext = path.extname(filename).toLowerCase();

        // Определяем MIME-тип
        const contentTypes = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.emf': 'image/x-emf',
          '.wmf': 'image/x-wmf'
        };

        images.push({
          id: entry.entryName,
          filename,
          contentType: contentTypes[ext] || 'application/octet-stream',
          data: entry.getData()
        });
      }
    }

    return images;
  }
}

module.exports = { DocxReader };
