/**
 * Terms Builder - генерация таблицы терминов и определений
 */

const { buildSimpleTable } = require('./table-builder');

/**
 * Генерация таблицы терминов
 * @param {Object} directiveData - Данные директивы {table: {headers, rows}}
 * @param {Object} styles - Конфигурация стилей
 * @returns {string} XML строка таблицы
 */
function buildTermsTable(directiveData, styles) {
  const { table } = directiveData;
  
  if (!table || !table.rows || table.rows.length === 0) {
    return '';
  }
  
  const headers = table.headers || ['Сокращение/Термин', 'Расшифровка / Определение'];
  
  return buildSimpleTable(headers, table.rows, styles, {
    columnWidths: [3000, 6500] // 30% на термин, 70% на определение
  });
}

module.exports = {
  buildTermsTable
};
