const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { DOMParser } = require('xmldom');

const docxPath = process.argv[2] || 'tests/test1-original/Очередь1_Реализация_изменений_функционала_МЧД_минимум_1.docx';

console.log('Анализ файла:', docxPath);
console.log('='.repeat(80));

try {
    const zip = new AdmZip(docxPath);
    const documentEntry = zip.getEntry('word/document.xml');

    if (!documentEntry) {
        console.error('Не найден document.xml в архиве');
        process.exit(1);
    }

    const xmlContent = documentEntry.getData().toString('utf8');
    const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');

    // Функция для получения текста из ячейки
    function getCellText(cell) {
        const texts = [];
        const textNodes = cell.getElementsByTagName('w:t');
        for (let i = 0; i < textNodes.length; i++) {
            const text = textNodes[i].textContent.trim();
            if (text) {
                texts.push(text);
            }
        }
        return texts.join(' ');
    }

    // Функция для получения контекста таблицы (текст перед таблицей)
    function getTableContext(tableElement) {
        let context = [];
        let sibling = tableElement.previousSibling;
        let count = 0;

        while (sibling && count < 5) {
            if (sibling.nodeName === 'w:p') {
                const texts = [];
                const textNodes = sibling.getElementsByTagName('w:t');
                for (let i = 0; i < textNodes.length; i++) {
                    const text = textNodes[i].textContent.trim();
                    if (text) {
                        texts.push(text);
                    }
                }
                const paraText = texts.join(' ').trim();
                if (paraText) {
                    context.unshift(paraText);
                    count++;
                }
            }
            sibling = sibling.previousSibling;
        }

        return context.join('\n');
    }

    // Функция для анализа таблицы
    function analyzeTable(tableElement, level = 0, parentContext = '') {
        const indent = '  '.repeat(level);

        if (level === 0) {
            console.log('\n' + '='.repeat(80));
            console.log('ОСНОВНАЯ ТАБЛИЦА #' + (tableIndex++));
            console.log('='.repeat(80));

            // Получаем контекст таблицы
            const context = getTableContext(tableElement);
            if (context) {
                console.log('\nКонтекст (текст перед таблицей):');
                console.log(context.substring(0, 500));
                if (context.length > 500) console.log('...');
            }
        } else {
            console.log('\n' + indent + '>>> ВЛОЖЕННАЯ ТАБЛИЦА (уровень ' + level + ') <<<');
            if (parentContext) {
                console.log(indent + 'Контекст родительской ячейки: ' + parentContext.substring(0, 200));
                if (parentContext.length > 200) console.log(indent + '...');
            }
        }

        // Анализируем строки таблицы
        const rows = tableElement.getElementsByTagName('w:tr');
        console.log(indent + 'Количество строк: ' + rows.length);

        let hasNestedTables = false;

        for (let i = 0; i < Math.min(rows.length, 10); i++) {
            const row = rows[i];
            const cells = row.getElementsByTagName('w:tc');

            console.log('\n' + indent + `Строка ${i + 1} (ячеек: ${cells.length}):`);

            for (let j = 0; j < cells.length; j++) {
                const cell = cells[j];
                const cellText = getCellText(cell);

                // Ищем вложенные таблицы в ячейке
                const nestedTables = [];
                for (let k = 0; k < cell.childNodes.length; k++) {
                    const child = cell.childNodes[k];
                    if (child.nodeName === 'w:tbl') {
                        nestedTables.push(child);
                    }
                }

                if (nestedTables.length > 0) {
                    hasNestedTables = true;
                    console.log(indent + `  Ячейка ${j + 1}: [СОДЕРЖИТ ${nestedTables.length} ВЛОЖЕННУЮ(ЫХ) ТАБЛИЦУ(Ы)]`);
                    if (cellText) {
                        console.log(indent + `    Текст до вложенной таблицы: "${cellText.substring(0, 150)}"`);
                        if (cellText.length > 150) console.log(indent + '    ...');
                    }

                    // Рекурсивно анализируем вложенные таблицы
                    nestedTables.forEach((nestedTable, idx) => {
                        console.log(indent + `    \n${indent}    Вложенная таблица #${idx + 1} в этой ячейке:`);
                        analyzeTable(nestedTable, level + 1, cellText);
                    });
                } else {
                    // Обычная ячейка без вложенных таблиц
                    const preview = cellText.substring(0, 100);
                    if (preview) {
                        console.log(indent + `  Ячейка ${j + 1}: "${preview}${cellText.length > 100 ? '...' : ''}"`);
                    } else {
                        console.log(indent + `  Ячейка ${j + 1}: [пусто]`);
                    }
                }
            }
        }

        if (rows.length > 10) {
            console.log(indent + `\n... (показано 10 из ${rows.length} строк)`);
        }

        return hasNestedTables;
    }

    // Находим все таблицы верхнего уровня
    const allTables = doc.getElementsByTagName('w:tbl');
    console.log(`\nВсего таблиц в документе (включая вложенные): ${allTables.length}`);

    // Находим таблицы верхнего уровня (не вложенные в ячейки)
    const topLevelTables = [];
    for (let i = 0; i < allTables.length; i++) {
        const table = allTables[i];
        let parent = table.parentNode;
        let isNested = false;

        // Проверяем, не является ли родитель ячейкой таблицы
        while (parent) {
            if (parent.nodeName === 'w:tc') {
                isNested = true;
                break;
            }
            if (parent.nodeName === 'w:body') {
                break;
            }
            parent = parent.parentNode;
        }

        if (!isNested) {
            topLevelTables.push(table);
        }
    }

    console.log(`Таблиц верхнего уровня: ${topLevelTables.length}`);
    console.log(`Вложенных таблиц: ${allTables.length - topLevelTables.length}`);

    // Счетчик для нумерации таблиц
    let tableIndex = 1;

    // Анализируем каждую таблицу верхнего уровня
    let tablesWithNested = 0;
    topLevelTables.forEach(table => {
        const hasNested = analyzeTable(table, 0);
        if (hasNested) {
            tablesWithNested++;
        }
    });

    console.log('\n' + '='.repeat(80));
    console.log('ИТОГОВАЯ СТАТИСТИКА');
    console.log('='.repeat(80));
    console.log(`Всего таблиц: ${allTables.length}`);
    console.log(`Таблиц верхнего уровня: ${topLevelTables.length}`);
    console.log(`Вложенных таблиц: ${allTables.length - topLevelTables.length}`);
    console.log(`Таблиц верхнего уровня, содержащих вложенные: ${tablesWithNested}`);

} catch (error) {
    console.error('Ошибка:', error);
    process.exit(1);
}
