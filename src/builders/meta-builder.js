/**
 * Meta Builder - генерация шапки документа, истории изменений и связанных документов
 */

const { escapeXml } = require('../utils/xml-utils');
const { buildTable, buildTableRow, buildTableCell, buildSimpleTable } = require('./table-builder');

/**
 * Создать XML параграфа с текстом
 * @param {string} text - Текст
 * @param {boolean} bold - Жирный
 * @param {string} color - Цвет текста (hex без #)
 */
function p(text, bold = false, color = null) {
  const escaped = escapeXml(text);
  let rPr = '';
  
  if (bold || color) {
    const props = [];
    if (bold) props.push('<w:b/>');
    if (color) props.push(`<w:color w:val="${color}"/>`);
    rPr = `<w:rPr>${props.join('')}</w:rPr>`;
  }
  
  return `<w:p><w:r>${rPr}<w:t>${escaped}</w:t></w:r></w:p>`;
}

/**
 * Генерация таблицы метаданных (шапка ЧТЗ)
 */
function buildMetaTable(metadata, styles) {
  const padding = styles.table.cellPadding;
  const headerBg = styles.colors.tableHeaderBackground;
  const headerTextColor = styles.colors.tableHeaderText;
  
  const col1 = 2500;
  const col2 = 4500;
  const col3 = 1000;
  const col4 = 2500;
  
  const rows = [];
  
  // Строка 1: Общее описание изменения
  rows.push(buildTableRow([
    buildTableCell(
      p('Общее описание изменения', true, headerTextColor),
      { width: col1 + col2 + col3 + col4, background: headerBg, padding, colspan: 4 }
    )
  ]));
  
  // Строка 2: Краткое название
  rows.push(buildTableRow([
    buildTableCell(p('Краткое название изменения:', true, headerTextColor), { width: col1, background: headerBg, padding }),
    buildTableCell(p(metadata.shortName || ''), { width: col2 + col3 + col4, padding, colspan: 3 })
  ]));
  
  // Строка 3: Консультант
  rows.push(buildTableRow([
    buildTableCell(p('Консультант:', true, headerTextColor), { width: col1, background: headerBg, padding }),
    buildTableCell(p(metadata.consultant?.name || ''), { width: col2, padding }),
    buildTableCell(p('E-mail:', true, headerTextColor), { width: col3, background: headerBg, padding }),
    buildTableCell(p(metadata.consultant?.email || ''), { width: col4, padding })
  ]));
  
  // Строка 4: Организация
  rows.push(buildTableRow([
    buildTableCell(p('Наименование организации Заказчика:', true, headerTextColor), { width: col1, background: headerBg, padding }),
    buildTableCell(p(metadata.organization || ''), { width: col2 + col3 + col4, padding, colspan: 3 })
  ]));
  
  // Строка 5: ИТ-решения
  const itSolutions = Array.isArray(metadata.itSolutions) 
    ? metadata.itSolutions.join(', ') 
    : metadata.itSolutions || '';
  rows.push(buildTableRow([
    buildTableCell(p('Наименование ИТ-решений (ЕСИС):', true, headerTextColor), { width: col1, background: headerBg, padding }),
    buildTableCell(p(itSolutions), { width: col2 + col3 + col4, padding, colspan: 3 })
  ]));
  
  // Строка 6: ИТ-системы
  const itSystems = Array.isArray(metadata.itSystems) 
    ? metadata.itSystems.join(', ') 
    : metadata.itSystems || '';
  rows.push(buildTableRow([
    buildTableCell(p('Наименование ИТ-систем (ЕСИС):', true, headerTextColor), { width: col1, background: headerBg, padding }),
    buildTableCell(p(itSystems), { width: col2 + col3 + col4, padding, colspan: 3 })
  ]));
  
  // Строка 7: КТ
  rows.push(buildTableRow([
    buildTableCell(p('Планируется обработка данных КТ:', true, headerTextColor), { width: col1, background: headerBg, padding }),
    buildTableCell(p(metadata.processKT ? 'Да' : 'Нет'), { width: col2 + col3 + col4, padding, colspan: 3 })
  ]));
  
  // Строка 8: ПДн
  rows.push(buildTableRow([
    buildTableCell(p('Планируется обработка данных ПДн:', true, headerTextColor), { width: col1, background: headerBg, padding }),
    buildTableCell(p(metadata.processPDn ? 'Да' : 'Нет'), { width: col2 + col3 + col4, padding, colspan: 3 })
  ]));
  
  // Строка 9: Дата создания
  rows.push(buildTableRow([
    buildTableCell(p('Дата создания ЧТЗ:', true, headerTextColor), { width: col1, background: headerBg, padding }),
    buildTableCell(p(metadata.createdDate || ''), { width: col2 + col3 + col4, padding, colspan: 3 })
  ]));
  
  return buildTable(rows, {
    columnWidths: [col1, col2, col3, col4],
    borders: true,
    borderColor: styles.colors.tableBorder
  });
}

/**
 * Генерация таблицы истории изменений
 */
function buildHistoryTable(history, styles) {
  if (!history || history.length === 0) {
    return '';
  }
  
  const title = `<w:p><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>История изменений:</w:t></w:r></w:p>`;
  
  const headers = ['Версия', 'Дата', 'Комментарий', 'Автор'];
  const rows = history.map(item => [
    item.version || '',
    item.date || '',
    item.comment || '',
    item.author || ''
  ]);
  
  const table = buildSimpleTable(headers, rows, styles, {
    columnWidths: [1000, 1500, 5000, 2000]
  });
  
  return title + table;
}

/**
 * Генерация таблицы связанных документов
 */
function buildRelatedDocsTable(relatedDocs, styles) {
  if (!relatedDocs || relatedDocs.length === 0) {
    return '';
  }
  
  const title = `<w:p><w:pPr><w:spacing w:before="240" w:after="60"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Связанные документы</w:t></w:r></w:p>`;
  const subtitle = `<w:p><w:pPr><w:spacing w:before="0" w:after="120"/></w:pPr><w:r><w:t>(этот документ должен читаться вместе с):</w:t></w:r></w:p>`;
  
  const headers = ['Название документа', 'Номер версии / Имя файла', 'Дата'];
  const rows = relatedDocs.map(doc => [
    doc.name || '',
    doc.version || '',
    doc.date || ''
  ]);
  
  const table = buildSimpleTable(headers, rows, styles, {
    columnWidths: [5500, 2500, 1500]
  });
  
  return title + subtitle + table;
}

/**
 * Генерация полной шапки документа
 */
function buildDocumentHeader(data, styles) {
  const parts = [];
  
  parts.push(buildMetaTable(data.metadata, styles));
  parts.push('<w:p/>');
  
  if (data.history && data.history.length > 0) {
    parts.push(buildHistoryTable(data.history, styles));
    parts.push('<w:p/>');
  }
  
  if (data.relatedDocs && data.relatedDocs.length > 0) {
    parts.push(buildRelatedDocsTable(data.relatedDocs, styles));
    parts.push('<w:p/>');
  }
  
  return parts.join('');
}

module.exports = {
  buildMetaTable,
  buildHistoryTable,
  buildRelatedDocsTable,
  buildDocumentHeader
};
