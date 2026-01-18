/**
 * Table Builder - генерация XML для таблиц
 */

const { escapeXml, textRun, paragraph } = require('../utils/xml-utils');
const { buildInlineContent } = require('./content-builder');

/**
 * Генерация XML для границ ячейки
 */
function buildCellBorders(options = {}) {
  const { color = '000000', width = 4 } = options;
  
  return `<w:tcBorders>
<w:top w:val="single" w:sz="${width}" w:space="0" w:color="${color}"/>
<w:left w:val="single" w:sz="${width}" w:space="0" w:color="${color}"/>
<w:bottom w:val="single" w:sz="${width}" w:space="0" w:color="${color}"/>
<w:right w:val="single" w:sz="${width}" w:space="0" w:color="${color}"/>
</w:tcBorders>`;
}

/**
 * Генерация XML для отступов ячейки
 */
function buildCellMargins(padding) {
  if (!padding) return '';
  
  return `<w:tcMar>
<w:top w:w="${padding.top || 0}" w:type="dxa"/>
<w:left w:w="${padding.left || 0}" w:type="dxa"/>
<w:bottom w:w="${padding.bottom || 0}" w:type="dxa"/>
<w:right w:w="${padding.right || 0}" w:type="dxa"/>
</w:tcMar>`;
}

/**
 * Генерация XML для ячейки таблицы
 * @param {string|Array} content - XML содержимое (уже готовые параграфы)
 * @param {Object} options - Параметры ячейки
 */
function buildTableCell(content, options = {}) {
  const {
    width,
    background,
    borders = true,
    borderColor = '000000',
    borderWidth = 4,
    padding,
    vAlign = 'top',
    colspan,
    rowspan
  } = options;
  
  const tcPr = [];
  
  if (width) {
    tcPr.push(`<w:tcW w:w="${width}" w:type="dxa"/>`);
  }
  
  if (colspan && colspan > 1) {
    tcPr.push(`<w:gridSpan w:val="${colspan}"/>`);
  }
  if (rowspan === 'restart') {
    tcPr.push('<w:vMerge w:val="restart"/>');
  } else if (rowspan === 'continue') {
    tcPr.push('<w:vMerge/>');
  }
  
  if (borders) {
    tcPr.push(buildCellBorders({ color: borderColor, width: borderWidth }));
  }
  
  if (background) {
    tcPr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${background}"/>`);
  }
  
  if (padding) {
    tcPr.push(buildCellMargins(padding));
  }
  
  if (vAlign) {
    tcPr.push(`<w:vAlign w:val="${vAlign}"/>`);
  }
  
  const tcPrXml = tcPr.length > 0 ? `<w:tcPr>${tcPr.join('')}</w:tcPr>` : '';
  
  // Контент уже должен быть XML параграфами
  let contentXml;
  if (typeof content === 'string') {
    // Если это уже XML (начинается с <w:p) - используем как есть
    if (content.trim().startsWith('<w:p')) {
      contentXml = content;
    } else {
      // Иначе создаём параграф с текстом
      contentXml = `<w:p><w:r><w:t>${escapeXml(content)}</w:t></w:r></w:p>`;
    }
  } else if (Array.isArray(content)) {
    contentXml = content.join('');
  } else {
    contentXml = '<w:p/>';
  }
  
  return `<w:tc>${tcPrXml}${contentXml}</w:tc>`;
}

/**
 * Генерация XML для строки таблицы
 */
function buildTableRow(cells, options = {}) {
  const { height, isHeader } = options;
  
  const trPr = [];
  
  if (height) {
    trPr.push(`<w:trHeight w:val="${height}"/>`);
  }
  
  if (isHeader) {
    trPr.push('<w:tblHeader/>');
  }
  
  const trPrXml = trPr.length > 0 ? `<w:trPr>${trPr.join('')}</w:trPr>` : '';
  
  return `<w:tr>${trPrXml}${cells.join('')}</w:tr>`;
}

/**
 * Генерация XML для таблицы
 */
function buildTable(rows, options = {}) {
  const {
    columnWidths,
    width = 5000,
    widthType = 'pct',
    borders = true,
    borderColor = '000000'
  } = options;
  
  const tblPr = [];
  
  tblPr.push(`<w:tblW w:w="${width}" w:type="${widthType}"/>`);
  
  if (borders) {
    tblPr.push(`<w:tblBorders>
<w:top w:val="single" w:sz="4" w:space="0" w:color="${borderColor}"/>
<w:left w:val="single" w:sz="4" w:space="0" w:color="${borderColor}"/>
<w:bottom w:val="single" w:sz="4" w:space="0" w:color="${borderColor}"/>
<w:right w:val="single" w:sz="4" w:space="0" w:color="${borderColor}"/>
<w:insideH w:val="single" w:sz="4" w:space="0" w:color="${borderColor}"/>
<w:insideV w:val="single" w:sz="4" w:space="0" w:color="${borderColor}"/>
</w:tblBorders>`);
  }
  
  tblPr.push(`<w:tblCellMar>
<w:top w:w="80" w:type="dxa"/>
<w:left w:w="120" w:type="dxa"/>
<w:bottom w:w="80" w:type="dxa"/>
<w:right w:w="120" w:type="dxa"/>
</w:tblCellMar>`);
  
  const tblPrXml = `<w:tblPr>${tblPr.join('')}</w:tblPr>`;
  
  let tblGrid = '';
  if (columnWidths && columnWidths.length > 0) {
    const gridCols = columnWidths.map(w => `<w:gridCol w:w="${w}"/>`).join('');
    tblGrid = `<w:tblGrid>${gridCols}</w:tblGrid>`;
  }
  
  return `<w:tbl>${tblPrXml}${tblGrid}${rows.join('')}</w:tbl>`;
}

/**
 * Генерация простой таблицы из массива данных
 */
function buildSimpleTable(headers, rows, styles, options = {}) {
  const {
    headerBackground = styles.colors.tableHeaderBackground,
    headerTextColor = styles.colors.tableHeaderText,
    borderColor = styles.colors.tableBorder,
    columnWidths
  } = options;
  
  const padding = styles.table.cellPadding;
  
  // Строка заголовка с белым жирным текстом
  const headerCells = headers.map((header, index) => {
    const textColorProp = headerTextColor ? `<w:color w:val="${headerTextColor}"/>` : '';
    return buildTableCell(
      `<w:p><w:r><w:rPr><w:b/>${textColorProp}</w:rPr><w:t>${escapeXml(header)}</w:t></w:r></w:p>`,
      {
        width: columnWidths ? columnWidths[index] : undefined,
        background: headerBackground,
        borderColor,
        padding
      }
    );
  });
  
  const headerRow = buildTableRow(headerCells, { isHeader: true });
  
  // Строки данных
  const dataRows = rows.map(row => {
    const cells = row.map((cell, index) => 
      buildTableCell(
        `<w:p><w:r><w:t>${escapeXml(cell)}</w:t></w:r></w:p>`,
        {
          width: columnWidths ? columnWidths[index] : undefined,
          borderColor,
          padding
        }
      )
    );
    return buildTableRow(cells);
  });
  
  return buildTable([headerRow, ...dataRows], {
    columnWidths,
    borders: true,
    borderColor
  });
}

/**
 * Генерация таблицы из AST узла table
 */
function buildTableFromAst(node, styles, context = {}) {
  const tableRows = [];
  const padding = styles.table.cellPadding;
  
  node.children.forEach((row, rowIndex) => {
    if (row.type === 'tableRow') {
      const cells = row.children
        .filter(cell => cell.type === 'tableCell')
        .map(cell => {
          const content = cell.children
            .map(child => buildInlineContent(child, context))
            .join('');
          
          const isHeader = rowIndex === 0;
          
          return buildTableCell(
            `<w:p>${content}</w:p>`,
            {
              background: isHeader ? styles.colors.tableHeaderBackground : undefined,
              padding
            }
          );
        });
      
      tableRows.push(buildTableRow(cells, { isHeader: rowIndex === 0 }));
    }
  });
  
  return buildTable(tableRows, {
    borders: true,
    borderColor: styles.colors.tableBorder
  });
}

module.exports = {
  buildTable,
  buildTableRow,
  buildTableCell,
  buildCellBorders,
  buildCellMargins,
  buildSimpleTable,
  buildTableFromAst
};
