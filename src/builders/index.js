/**
 * Builders Module - экспорт всех билдеров
 */

const { buildDocument, createBuildContext } = require('./document-builder');
const { buildDocumentHeader, buildMetaTable, buildHistoryTable, buildRelatedDocsTable } = require('./meta-builder');
const { buildContent, buildHeading, buildParagraph, buildList } = require('./content-builder');
const { buildTable, buildTableRow, buildTableCell, buildSimpleTable, buildTableFromAst } = require('./table-builder');
const { buildTermsTable } = require('./terms-builder');
const { buildChangesTable } = require('./changes-builder');
const { buildFunctionTable } = require('./function-table-builder');
const { buildImageParagraph, buildImageXml, getImageDimensions, pixelsToEmu } = require('./image-builder');

module.exports = {
  // Document
  buildDocument,
  createBuildContext,
  
  // Meta
  buildDocumentHeader,
  buildMetaTable,
  buildHistoryTable,
  buildRelatedDocsTable,
  
  // Content
  buildContent,
  buildHeading,
  buildParagraph,
  buildList,
  
  // Tables
  buildTable,
  buildTableRow,
  buildTableCell,
  buildSimpleTable,
  buildTableFromAst,
  
  // Special tables
  buildTermsTable,
  buildChangesTable,
  buildFunctionTable,
  
  // Images
  buildImageParagraph,
  buildImageXml,
  getImageDimensions,
  pixelsToEmu
};
