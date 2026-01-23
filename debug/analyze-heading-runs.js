/**
 * Анализ структуры runs в заголовках таблиц
 *
 * Использование:
 *   node debug/analyze-heading-runs.js path/to/document.docx
 */

const AdmZip = require('adm-zip');
const { XmlParser } = require('./src/reverse/reader/xml-parser');

const docxPath = process.argv[2];

if (!docxPath) {
  console.error('Укажите путь к DOCX файлу:');
  console.error('  node debug/analyze-heading-runs.js path/to/document.docx');
  process.exit(1);
}

const zip = new AdmZip(docxPath);
const docXml = zip.readAsText('word/document.xml');

const parser = new XmlParser();
const doc = parser.parse(docXml);

// Ищем параграфы с заголовками таблиц 6 и 7
function findHeadings(obj, path = '') {
  if (!obj || typeof obj !== 'object') return;

  if (obj['w:p']) {
    const p = obj['w:p'];
    const pArray = Array.isArray(p) ? p : [p];

    for (const para of pArray) {
      // Собираем текст из runs
      const runs = para['w:r'];
      if (runs) {
        const rArray = Array.isArray(runs) ? runs : [runs];
        const fullText = rArray.map(r => {
          const wT = r['w:t'];
          return typeof wT === 'string' ? wT : (wT ? wT['#text'] || '' : '');
        }).join('');

        // Ищем заголовки таблиц (можно изменить критерий поиска)
        if (fullText.includes('Таблица')) {
          console.log('\n='.repeat(80));
          console.log('Найден заголовок:', fullText);
          console.log('Количество runs:', rArray.length);
          console.log('\nСтруктура runs:');

          rArray.forEach((run, idx) => {
            const wT = run['w:t'];
            const text = typeof wT === 'string' ? wT : (wT ? wT['#text'] || '' : '');
            const xmlSpace = wT && typeof wT === 'object' ? wT['@_xml:space'] : undefined;

            console.log(`Run ${idx}: "${text}" ${xmlSpace ? `[xml:space="${xmlSpace}"]` : ''}`);

            // Покажем полную структуру w:t
            if (wT && typeof wT === 'object') {
              console.log(`  w:t structure:`, JSON.stringify(wT, null, 2));
            }
          });
        }
      }
    }
  }

  // Рекурсивно ищем дальше
  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      findHeadings(obj[key], path ? `${path}.${key}` : key);
    }
  }
}

findHeadings(doc);
console.log('\n');
