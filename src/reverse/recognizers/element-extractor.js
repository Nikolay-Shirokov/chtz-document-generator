/**
 * ElementExtractor - извлекает структурированные элементы из body документа
 * Преобразует сырой XML в удобный формат
 */

class ElementExtractor {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Извлекает элементы из body документа
   * @param {Array} body - массив элементов body
   * @param {DocumentAST} ast - полный AST для доступа к стилям
   * @returns {Array<Element>}
   */
  extract(body, ast) {
    const elements = [];

    // Body может быть массивом или объектом с дочерними элементами
    const items = this.normalizeBody(body);

    for (const item of items) {
      const extracted = this.extractElement(item, ast);
      if (extracted) {
        elements.push(extracted);
      }
    }

    return elements;
  }

  /**
   * Нормализует body в массив элементов
   */
  normalizeBody(body) {
    if (Array.isArray(body)) {
      // Если массив содержит один объект с дочерними элементами
      if (body.length === 1 && typeof body[0] === 'object') {
        return this.flattenBody(body[0]);
      }
      return body;
    }

    if (typeof body === 'object') {
      return this.flattenBody(body);
    }

    return [];
  }

  /**
   * Разворачивает объект body в массив элементов
   */
  flattenBody(bodyObj) {
    const elements = [];

    // ИСПРАВЛЕНИЕ: Используем __children__ для сохранения порядка элементов
    if (bodyObj['__children__']) {
      for (const child of bodyObj['__children__']) {
        const key = Object.keys(child)[0];
        if (key === 'w:p' || key === 'w:tbl') {
          elements.push({ type: key, data: child[key] });
        }
      }
      return elements;
    }

    // Старый способ (если нет __children__) - группирует по типам
    for (const key of Object.keys(bodyObj)) {
      if (key === 'w:p' || key === 'w:tbl') {
        const items = Array.isArray(bodyObj[key]) ? bodyObj[key] : [bodyObj[key]];
        for (const item of items) {
          elements.push({ type: key, data: item });
        }
      }
    }

    return elements;
  }

  /**
   * Извлекает один элемент
   */
  extractElement(item, ast) {
    // Если элемент уже в формате {type, data}
    if (item.type && item.data) {
      if (item.type === 'w:p') {
        return this.extractParagraph(item.data, ast);
      }
      if (item.type === 'w:tbl') {
        return this.extractTable(item.data, ast);
      }
    }

    // Сырой XML объект
    if (item['w:p']) {
      return this.extractParagraph(item['w:p'], ast);
    }
    if (item['w:tbl']) {
      return this.extractTable(item['w:tbl'], ast);
    }

    // Параграф напрямую
    if (item['w:pPr'] || item['w:r']) {
      return this.extractParagraph(item, ast);
    }

    return null;
  }

  /**
   * Извлекает параграф
   */
  extractParagraph(p, ast) {
    const result = {
      type: 'paragraph',
      text: '',
      style: null,
      level: 0,
      formatting: [],
      runs: [],
      isHeading: false,
      headingLevel: 0,
      listInfo: null
    };

    // Извлекаем свойства параграфа
    const pPr = p['w:pPr'];
    if (pPr) {
      // Стиль
      const pStyle = pPr['w:pStyle'];
      if (pStyle) {
        result.style = pStyle['@_w:val'] || null;
        result.isHeading = this.isHeadingStyle(result.style);
        result.headingLevel = this.getHeadingLevel(result.style);
      }

      // Нумерация (списки)
      const numPr = pPr['w:numPr'];
      if (numPr) {
        result.listInfo = {
          numId: numPr['w:numId'] ? numPr['w:numId']['@_w:val'] : null,
          level: numPr['w:ilvl'] ? numPr['w:ilvl']['@_w:val'] : '0'
        };
      }
    }

    // Извлекаем runs (текстовые фрагменты)
    const runs = this.extractRuns(p);
    result.runs = runs;
    result.text = runs.map(r => r.text).join('');

    return result;
  }

  /**
   * Извлекает runs из параграфа
   * Обрабатывает как обычные runs (w:r), так и гиперссылки (w:hyperlink)
   */
  extractRuns(p) {
    const runs = [];

    // Используем __children__ для сохранения порядка элементов, если доступно
    if (p['__children__']) {
      for (const child of p['__children__']) {
        const key = Object.keys(child)[0];
        if (key === 'w:r') {
          const extracted = this.extractRun(child[key]);
          if (extracted) {
            runs.push(extracted);
          }
        } else if (key === 'w:hyperlink') {
          const hyperRuns = this.extractHyperlink(child[key]);
          runs.push(...hyperRuns);
        }
      }
      return runs;
    }

    // Fallback: обрабатываем w:r и w:hyperlink отдельно
    // (порядок может быть нарушен)
    const wRuns = p['w:r'];
    if (wRuns) {
      const runArray = Array.isArray(wRuns) ? wRuns : [wRuns];
      for (const run of runArray) {
        const extracted = this.extractRun(run);
        if (extracted) {
          runs.push(extracted);
        }
      }
    }

    // Обрабатываем гиперссылки
    const hyperlinks = p['w:hyperlink'];
    if (hyperlinks) {
      const hyperlinkArray = Array.isArray(hyperlinks) ? hyperlinks : [hyperlinks];
      for (const hyperlink of hyperlinkArray) {
        const hyperRuns = this.extractHyperlink(hyperlink);
        runs.push(...hyperRuns);
      }
    }

    return runs;
  }

  /**
   * Извлекает runs из гиперссылки
   * @param {Object} hyperlink - w:hyperlink элемент
   * @returns {Array} массив runs с информацией о ссылке
   */
  extractHyperlink(hyperlink) {
    const runs = [];

    // Получаем информацию о ссылке
    const rId = hyperlink['@_r:id'];  // Внешняя ссылка (через relationship)
    const anchor = hyperlink['@_w:anchor'];  // Внутренняя ссылка (bookmark)

    // Извлекаем runs из гиперссылки
    const wRuns = hyperlink['w:r'];
    if (!wRuns) return runs;

    const runArray = Array.isArray(wRuns) ? wRuns : [wRuns];

    for (const run of runArray) {
      const extracted = this.extractRun(run);
      if (extracted) {
        // Добавляем информацию о ссылке
        extracted.hyperlink = {
          rId: rId || null,
          anchor: anchor || null
        };
        runs.push(extracted);
      }
    }

    return runs;
  }

  /**
   * Извлекает один run
   */
  extractRun(run) {
    const result = {
      text: '',
      bold: false,
      italic: false,
      underline: false,
      image: null
    };

    // Свойства run
    const rPr = run['w:rPr'];
    if (rPr) {
      result.bold = !!rPr['w:b'];
      result.italic = !!rPr['w:i'];
      result.underline = !!rPr['w:u'];
    }

    // Изображение (w:drawing) - может быть напрямую или внутри mc:AlternateContent
    let drawing = run['w:drawing'];

    // Проверяем mc:AlternateContent (используется для совместимости в OOXML)
    if (!drawing && run['mc:AlternateContent']) {
      const altContent = run['mc:AlternateContent'];
      const choice = altContent['mc:Choice'];
      if (choice) {
        drawing = choice['w:drawing'];
      }
      // Если нет в Choice, проверяем Fallback
      if (!drawing && altContent['mc:Fallback']) {
        drawing = altContent['mc:Fallback']['w:drawing'];
      }
    }

    if (drawing) {
      const imageInfo = this.extractImage(drawing);
      if (imageInfo) {
        result.image = imageInfo;
        result.text = ''; // Изображения не имеют текста
        return result;
      }
    }

    // Текст
    const wT = run['w:t'];
    if (wT) {
      result.text = typeof wT === 'string' ? wT : (wT['#text'] || '');
    }

    // Tab
    if (run['w:tab']) {
      result.text = '\t';
    }

    // Break
    if (run['w:br']) {
      result.text = '\n';
    }

    return result;
  }

  /**
   * Извлекает информацию об изображении из w:drawing
   */
  extractImage(drawing) {
    try {
      // Изображения могут быть inline или anchor
      const inline = drawing['wp:inline'] || drawing['wp:anchor'];
      if (!inline) return null;

      // Ищем blip (ссылку на изображение)
      const graphic = inline['a:graphic'];
      if (!graphic) return null;

      const graphicData = graphic['a:graphicData'];
      if (!graphicData) return null;

      const pic = graphicData['pic:pic'];
      if (!pic) return null;

      const blipFill = pic['pic:blipFill'];
      if (!blipFill) return null;

      const blip = blipFill['a:blip'];
      if (!blip) return null;

      // Получаем relationship ID
      const embedId = blip['@_r:embed'];
      if (!embedId) return null;

      // Получаем alt text (если есть)
      const nvPicPr = pic['pic:nvPicPr'];
      const cNvPr = nvPicPr ? nvPicPr['pic:cNvPr'] : null;
      const alt = cNvPr ? (cNvPr['@_descr'] || cNvPr['@_name'] || '') : '';

      return {
        id: embedId,
        alt: alt
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Извлекает таблицу
   */
  extractTable(tbl, ast) {
    const result = {
      type: 'table',
      rows: [],
      properties: {}
    };

    // Свойства таблицы
    const tblPr = tbl['w:tblPr'];
    if (tblPr) {
      result.properties = this.extractTableProperties(tblPr);
    }

    // Строки таблицы
    const rows = tbl['w:tr'];
    if (rows) {
      const rowArray = Array.isArray(rows) ? rows : [rows];
      for (const row of rowArray) {
        result.rows.push(this.extractTableRow(row, ast));
      }
    }

    return result;
  }

  /**
   * Извлекает свойства таблицы
   */
  extractTableProperties(tblPr) {
    const props = {};

    // Ширина таблицы
    const width = tblPr['w:tblW'];
    if (width) {
      props.width = width['@_w:w'];
      props.widthType = width['@_w:type'];
    }

    return props;
  }

  /**
   * Извлекает строку таблицы
   */
  extractTableRow(tr, ast) {
    const row = {
      cells: []
    };

    const cells = tr['w:tc'];
    if (cells) {
      const cellArray = Array.isArray(cells) ? cells : [cells];
      for (const cell of cellArray) {
        row.cells.push(this.extractTableCell(cell, ast));
      }
    }

    return row;
  }

  /**
   * Извлекает ячейку таблицы
   */
  extractTableCell(tc, ast) {
    const cell = {
      paragraphs: [],
      tables: [],  // Добавляем поддержку вложенных таблиц
      text: ''
    };

    // Параграфы в ячейке
    const paragraphs = tc['w:p'];
    if (paragraphs) {
      const pArray = Array.isArray(paragraphs) ? paragraphs : [paragraphs];
      for (const p of pArray) {
        const extracted = this.extractParagraph(p, ast);
        if (extracted) {
          cell.paragraphs.push(extracted);
        }
      }
    }

    // Вложенные таблицы в ячейке
    const nestedTables = tc['w:tbl'];
    if (nestedTables) {
      const tblArray = Array.isArray(nestedTables) ? nestedTables : [nestedTables];
      for (const tbl of tblArray) {
        const extractedTable = this.extractTable(tbl, ast);
        if (extractedTable) {
          cell.tables.push(extractedTable);
        }
      }
    }

    // Собираем текст из параграфов
    cell.text = cell.paragraphs.map(p => p.text).join('\n');

    return cell;
  }

  /**
   * Проверяет, является ли стиль заголовком
   */
  isHeadingStyle(styleId) {
    if (!styleId) return false;
    // Стандартные стили заголовков: Heading1, Heading2, 1, 2, 3, 4
    return /^(Heading\d+|\d+)$/i.test(styleId);
  }

  /**
   * Определяет уровень заголовка по стилю
   */
  getHeadingLevel(styleId) {
    if (!styleId) return 0;

    // Heading1, Heading2, etc.
    const headingMatch = styleId.match(/^Heading(\d+)$/i);
    if (headingMatch) {
      return parseInt(headingMatch[1], 10);
    }

    // Просто число: 1, 2, 3, 4
    const numMatch = styleId.match(/^(\d+)$/);
    if (numMatch) {
      return parseInt(numMatch[1], 10);
    }

    return 0;
  }
}

module.exports = { ElementExtractor };
