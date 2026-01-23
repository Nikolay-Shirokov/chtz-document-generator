/**
 * Debug script to check if br tags create multiple paragraphs in DOCX
 */

const AdmZip = require('adm-zip');
const { XmlParser } = require('./src/reverse/reader/xml-parser');

const docxPath = process.argv[2] || 'test-br-tags.docx';

const zip = new AdmZip(docxPath);
const docXml = zip.readAsText('word/document.xml');

const parser = new XmlParser();
const doc = parser.parse(docXml);

// Find all tables
function findTables(obj, path = '') {
  if (!obj || typeof obj !== 'object') return;

  if (obj['w:tbl']) {
    console.log(`\n=== Found table at ${path} ===`);
    const tbl = obj['w:tbl'];

    // Check rows
    const rows = tbl['w:tr'];
    if (rows) {
      const rowArray = Array.isArray(rows) ? rows : [rows];
      rowArray.forEach((row, rowIdx) => {
        const cells = row['w:tc'];
        if (cells) {
          const cellArray = Array.isArray(cells) ? cells : [cells];
          cellArray.forEach((cell, cellIdx) => {
            const paragraphs = cell['w:p'];
            if (paragraphs) {
              const pArray = Array.isArray(paragraphs) ? paragraphs : [paragraphs];
              console.log(`Row ${rowIdx}, Cell ${cellIdx}: ${pArray.length} paragraph(s)`);
              pArray.forEach((p, pIdx) => {
                const runs = p['w:r'];
                if (runs) {
                  const rArray = Array.isArray(runs) ? runs : [runs];
                  const text = rArray.map(r => {
                    const wT = r['w:t'];
                    return typeof wT === 'string' ? wT : (wT ? wT['#text'] || '' : '');
                  }).join('');
                  console.log(`  Para ${pIdx}: "${text}"`);
                }
              });
            }
          });
        }
      });
    }
  }

  // Recursively search
  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      findTables(obj[key], path ? `${path}.${key}` : key);
    }
  }
}

findTables(doc);
console.log('\nDone');
