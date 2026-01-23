/**
 * Check raw XML to see if multiple paragraphs are created
 */

const AdmZip = require('adm-zip');

const docxPath = process.argv[2] || 'test-br-tags.docx';

const zip = new AdmZip(docxPath);
const docXml = zip.readAsText('word/document.xml');

// Find the first nested table (search for Header 1 and Header 2)
const match = docXml.match(/<w:tbl>[\s\S]*?<w:t[^>]*>Header 1<\/w:t>[\s\S]*?<w:t[^>]*>Header 2<\/w:t>[\s\S]*?<\/w:tbl>/);

if (match) {
  console.log('Found nested table XML:');
  console.log('='.repeat(80));

  // Prettify a bit
  const xml = match[0]
    .replace(/<w:tc>/g, '\n<w:tc>')
    .replace(/<w:p>/g, '\n  <w:p>')
    .replace(/<\/w:tc>/g, '\n</w:tc>');

  console.log(xml);
} else {
  console.log('Nested table not found');
}
