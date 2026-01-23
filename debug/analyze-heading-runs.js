/**
 * Анализ структуры runs в заголовках таблиц 6 и 7
 */

const AdmZip = require('adm-zip');
const { XmlParser } = require('./src/reverse/reader/xml-parser');

const docxPath = 'tests/test1-original/Очередь1_Реализация_изменений_функционала_МЧД_минимум_1.docx';

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

        // Проверяем, содержит ли "Таблица" и "Подписание"
        if (fullText.includes('Таблица') && fullText.includes('Подписание')) {
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
