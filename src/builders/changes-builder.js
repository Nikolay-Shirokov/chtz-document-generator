/**
 * Changes Builder - генерация таблицы "Как есть / Как будет"
 */

const { buildSimpleTable } = require('./table-builder');

/**
 * Генерация таблицы изменений
 * @param {Object} directiveData - Данные директивы {table: {headers, rows}}
 * @param {Object} styles - Конфигурация стилей
 * @returns {string} XML строка таблицы
 */
function buildChangesTable(directiveData, styles) {
  const { table } = directiveData;
  
  if (!table || !table.rows || table.rows.length === 0) {
    return '';
  }
  
  const headers = table.headers || ['Описание функции «Как есть»', 'Описание функции «Как будет»'];
  
  return buildSimpleTable(headers, table.rows, styles, {
    columnWidths: [4750, 4750] // 50% на каждую колонку
  });
}

module.exports = {
  buildChangesTable
};
