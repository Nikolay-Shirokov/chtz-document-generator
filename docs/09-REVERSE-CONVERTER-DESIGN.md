# Технический дизайн: Обратный конвертер DOCX → Markdown

## 1. Обзор

### 1.1 Цель документа

Описание архитектуры и технических решений для реализации обратного конвертера, преобразующего документы ЧТЗ из формата DOCX в Markdown с YAML front matter.

### 1.2 Scope

- Парсинг DOCX (Office Open XML)
- Распознавание структуры ЧТЗ
- Генерация Markdown с директивами
- CLI-интерфейс

### 1.3 Ключевые решения

| Решение | Выбор | Обоснование |
|---------|-------|-------------|
| Парсинг ZIP | `jszip` | Уже используется в проекте |
| Парсинг XML | `fast-xml-parser` | Высокая производительность, поддержка атрибутов |
| CLI | `commander` | Уже используется в проекте |
| Генерация YAML | `js-yaml` | Стандарт де-факто для Node.js |

---

## 2. Архитектура

### 2.1 Диаграмма компонентов

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLI Layer                                   │
│                         src/cli/reverse.js                              │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────────┐
│                          ReverseConverter                                │
│                    src/reverse/converter.js                             │
│                                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │ DocxReader  │───►│ Recognizers │───►│ MdBuilder   │                  │
│  └─────────────┘    └─────────────┘    └─────────────┘                  │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│  DocxReader   │       │  Recognizers  │       │   MdBuilder   │
│               │       │               │       │               │
│ - unzip       │       │ - metadata    │       │ - yaml        │
│ - parseXml    │       │ - sections    │       │ - sections    │
│ - extractRels │       │ - tables      │       │ - directives  │
│ - getImages   │       │ - formatting  │       │ - content     │
└───────────────┘       └───────────────┘       └───────────────┘
```

### 2.2 Поток данных

```
DOCX File
    │
    ▼
┌─────────────────┐
│   DocxReader    │
│                 │
│ 1. Unzip DOCX   │
│ 2. Parse XML    │
│ 3. Build AST    │
└────────┬────────┘
         │
         ▼
    DocumentAST
    {
      body: [...],
      styles: {...},
      relations: {...},
      images: [...]
    }
         │
         ▼
┌─────────────────┐
│   Recognizers   │
│                 │
│ 1. Metadata     │
│ 2. Sections     │
│ 3. Tables       │
│ 4. Formatting   │
└────────┬────────┘
         │
         ▼
    RecognizedDoc
    {
      metadata: {...},
      sections: [...],
      images: [...]
    }
         │
         ▼
┌─────────────────┐
│   MdBuilder     │
│                 │
│ 1. YAML front   │
│ 2. Sections     │
│ 3. Directives   │
└────────┬────────┘
         │
         ▼
   Markdown String
```

---

## 3. Структура файлов

```
src/
├── reverse/
│   ├── index.js                 # Публичный API
│   ├── converter.js             # Главный класс ReverseConverter
│   │
│   ├── reader/
│   │   ├── docx-reader.js       # Чтение и распаковка DOCX
│   │   ├── xml-parser.js        # Парсинг XML в AST
│   │   ├── styles-parser.js     # Парсинг стилей
│   │   └── relations-parser.js  # Парсинг связей (изображения, ссылки)
│   │
│   ├── recognizers/
│   │   ├── index.js             # Оркестратор распознавателей
│   │   ├── metadata.js          # Распознавание метаданных
│   │   ├── sections.js          # Распознавание разделов
│   │   ├── tables/
│   │   │   ├── index.js         # Роутер таблиц
│   │   │   ├── terms-table.js   # Таблица терминов
│   │   │   ├── changes-table.js # Таблица изменений
│   │   │   └── function-table.js# Функциональная таблица
│   │   ├── formatting.js        # Распознавание форматирования
│   │   └── notes.js             # Распознавание примечаний
│   │
│   └── builder/
│       ├── md-builder.js        # Главный билдер Markdown
│       ├── yaml-builder.js      # Генерация YAML front matter
│       ├── section-builder.js   # Генерация разделов
│       └── directive-builder.js # Генерация директив
│
├── cli/
│   └── reverse.js               # CLI команда reverse
│
└── shared/
    └── constants.js             # Общие константы
```

---

## 4. Детальный дизайн компонентов

### 4.1 DocxReader

**Файл:** `src/reverse/reader/docx-reader.js`

**Ответственность:** Чтение DOCX-файла, распаковка, парсинг XML.

```javascript
class DocxReader {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Читает DOCX файл и возвращает DocumentAST
   * @param {string|Buffer} input - путь к файлу или Buffer
   * @returns {Promise<DocumentAST>}
   */
  async read(input) {
    const zip = await this.unzip(input);

    const [document, styles, relations, numbering] = await Promise.all([
      this.parseXml(zip, 'word/document.xml'),
      this.parseXml(zip, 'word/styles.xml'),
      this.parseXml(zip, 'word/_rels/document.xml.rels'),
      this.parseXml(zip, 'word/numbering.xml'),
    ]);

    const images = await this.extractImages(zip);

    return {
      body: document['w:document']['w:body'],
      styles: this.parseStyles(styles),
      relations: this.parseRelations(relations),
      numbering: this.parseNumbering(numbering),
      images,
    };
  }

  async unzip(input) { /* ... */ }
  async parseXml(zip, path) { /* ... */ }
  async extractImages(zip) { /* ... */ }
  parseStyles(stylesXml) { /* ... */ }
  parseRelations(relsXml) { /* ... */ }
  parseNumbering(numberingXml) { /* ... */ }
}
```

**DocumentAST:**

```typescript
interface DocumentAST {
  body: Element[];           // Массив элементов документа
  styles: StylesMap;         // Карта стилей
  relations: RelationsMap;   // Связи (изображения, ссылки)
  numbering: NumberingMap;   // Определения нумерации
  images: ImageData[];       // Извлечённые изображения
}

interface StylesMap {
  [styleId: string]: {
    name: string;
    basedOn?: string;
    type: 'paragraph' | 'character' | 'table';
  }
}

interface RelationsMap {
  [rId: string]: {
    type: 'image' | 'hyperlink' | 'other';
    target: string;
  }
}

interface ImageData {
  id: string;
  filename: string;
  contentType: string;
  data: Buffer;
}
```

### 4.2 Recognizers

#### 4.2.1 MetadataRecognizer

**Файл:** `src/reverse/recognizers/metadata.js`

**Ответственность:** Извлечение метаданных из титульной страницы.

```javascript
class MetadataRecognizer {
  /**
   * Паттерны для распознавания полей метаданных
   */
  static PATTERNS = {
    shortName: /^(?:Краткое название|Название изменения):\s*(.+)$/i,
    consultant: /^(?:Консультант|Автор):\s*(.+)$/i,
    email: /^(?:Email|E-mail):\s*(\S+@\S+)$/i,
    organization: /^(?:Организация|Заказчик):\s*(.+)$/i,
    createdDate: /^(?:Дата создания|Дата):\s*(\d{2}\.\d{2}\.\d{4})$/i,
    itSolution: /^(?:ИТ-решение|Система):\s*(.+)$/i,
    itSystem: /^(?:ИТ-система|Подсистема):\s*(.+)$/i,
  };

  /**
   * Распознаёт метаданные из AST
   * @param {DocumentAST} ast
   * @returns {Metadata}
   */
  recognize(ast) {
    const metadata = {
      shortName: '',
      consultant: { name: '', email: '' },
      organization: '',
      itSolutions: [],
      itSystems: [],
      processKT: false,
      processPDn: false,
      createdDate: '',
    };

    // Анализируем первые N параграфов (титульная страница)
    const titleElements = this.extractTitlePage(ast.body);

    for (const element of titleElements) {
      this.matchAndExtract(element, metadata);
    }

    return metadata;
  }

  extractTitlePage(body) { /* ... */ }
  matchAndExtract(element, metadata) { /* ... */ }
}
```

#### 4.2.2 SectionRecognizer

**Файл:** `src/reverse/recognizers/sections.js`

**Ответственность:** Распознавание структуры разделов.

```javascript
class SectionRecognizer {
  /**
   * Известные разделы ЧТЗ
   */
  static KNOWN_SECTIONS = [
    { pattern: /^1\.\s*Термины/i, id: 'terms' },
    { pattern: /^2\.\s*Исходные данные/i, id: 'background' },
    { pattern: /^3\.\s*Изменение функционала/i, id: 'changes' },
    { pattern: /^4\.\s*Описание изменений в ИТ/i, id: 'it-changes' },
    { pattern: /^5\.\s*Описание изменений в интеграционных/i, id: 'integrations' },
    { pattern: /^6\.\s*Описание изменений.*ПДн/i, id: 'pdn' },
    { pattern: /^7\.\s*Входные формы/i, id: 'input-forms' },
    { pattern: /^8\.\s*Выходные формы/i, id: 'output-forms' },
    { pattern: /^9\.\s*Описание изменений в ролевой/i, id: 'roles' },
    { pattern: /^10\.\s*Приложения/i, id: 'appendix' },
  ];

  /**
   * Распознаёт разделы документа
   * @param {DocumentAST} ast
   * @returns {Section[]}
   */
  recognize(ast) {
    const sections = [];
    let currentSection = null;

    for (const element of ast.body) {
      if (this.isHeading(element, ast.styles)) {
        const level = this.getHeadingLevel(element, ast.styles);
        const text = this.getText(element);

        if (level === 1) {
          if (currentSection) sections.push(currentSection);
          currentSection = this.createSection(text, level);
        } else if (currentSection) {
          currentSection.subsections.push(this.createSection(text, level));
        }
      } else if (currentSection) {
        currentSection.content.push(element);
      }
    }

    if (currentSection) sections.push(currentSection);
    return sections;
  }

  isHeading(element, styles) { /* ... */ }
  getHeadingLevel(element, styles) { /* ... */ }
  getText(element) { /* ... */ }
  createSection(text, level) { /* ... */ }
}
```

#### 4.2.3 TableRecognizer

**Файл:** `src/reverse/recognizers/tables/index.js`

**Ответственность:** Маршрутизация распознавания таблиц.

```javascript
class TableRecognizer {
  constructor() {
    this.recognizers = [
      new TermsTableRecognizer(),
      new ChangesTableRecognizer(),
      new FunctionTableRecognizer(),
    ];
  }

  /**
   * Распознаёт тип таблицы и преобразует в соответствующую директиву
   * @param {TableElement} table
   * @param {Context} context
   * @returns {RecognizedTable}
   */
  recognize(table, context) {
    for (const recognizer of this.recognizers) {
      if (recognizer.canRecognize(table)) {
        return recognizer.recognize(table, context);
      }
    }

    // Обычная таблица
    return {
      type: 'regular',
      content: this.convertToMarkdownTable(table),
    };
  }

  convertToMarkdownTable(table) { /* ... */ }
}
```

#### 4.2.4 FunctionTableRecognizer

**Файл:** `src/reverse/recognizers/tables/function-table.js`

**Ответственность:** Распознавание функциональных таблиц.

```javascript
class FunctionTableRecognizer {
  /**
   * Паттерны для распознавания полей функциональной таблицы
   */
  static FIELD_PATTERNS = {
    function: /^[•●]\s*Функция:\s*(.+)$/i,
    task: /^[•●]\s*Задача:\s*(.+)$/i,
    taskUrl: /^[•●]\s*(?:Ссылка|URL):\s*(https?:\/\/.+)$/i,
    scenario: /^Сценарий:$/i,
  };

  /**
   * Проверяет, является ли таблица функциональной
   */
  canRecognize(table) {
    const firstCellText = this.getFirstCellText(table);
    return FunctionTableRecognizer.FIELD_PATTERNS.function.test(firstCellText);
  }

  /**
   * Распознаёт функциональную таблицу
   */
  recognize(table, context) {
    const rows = this.getRows(table);

    // Первая строка — метаданные функции
    const headerRow = rows[0];
    const headerText = this.getCellText(headerRow);

    const functionMatch = headerText.match(/Функция:\s*(.+)/i);
    const taskMatch = headerText.match(/Задача:\s*(\S+)/i);
    const urlMatch = headerText.match(/(https?:\/\/\S+)/i);

    // Вторая строка — сценарий
    const scenarioRow = rows[1];
    const scenarioText = this.getCellText(scenarioRow);

    return {
      type: 'function-table',
      id: context.generateId(),
      function: functionMatch ? functionMatch[1].trim() : '',
      task: taskMatch ? taskMatch[1].trim() : '',
      taskUrl: urlMatch ? urlMatch[1].trim() : null,
      scenario: this.parseScenario(scenarioText),
    };
  }

  parseScenario(text) { /* ... */ }
  getFirstCellText(table) { /* ... */ }
  getRows(table) { /* ... */ }
  getCellText(row) { /* ... */ }
}
```

### 4.3 MdBuilder

**Файл:** `src/reverse/builder/md-builder.js`

**Ответственность:** Генерация итогового Markdown.

```javascript
class MdBuilder {
  constructor(options = {}) {
    this.yamlBuilder = new YamlBuilder();
    this.sectionBuilder = new SectionBuilder();
    this.directiveBuilder = new DirectiveBuilder();
  }

  /**
   * Собирает Markdown из распознанного документа
   * @param {RecognizedDoc} doc
   * @returns {string}
   */
  build(doc) {
    const parts = [];

    // 1. YAML front matter
    parts.push(this.yamlBuilder.build(doc.metadata, doc.history));

    // 2. Разделы
    for (const section of doc.sections) {
      parts.push(this.buildSection(section));
    }

    return parts.join('\n\n');
  }

  buildSection(section) {
    const parts = [];

    // Заголовок
    const prefix = '#'.repeat(section.level);
    parts.push(`${prefix} ${section.title}`);

    // Контент
    for (const element of section.content) {
      parts.push(this.buildElement(element));
    }

    // Подразделы
    for (const subsection of section.subsections) {
      parts.push(this.buildSection(subsection));
    }

    return parts.join('\n\n');
  }

  buildElement(element) {
    switch (element.type) {
      case 'paragraph':
        return this.buildParagraph(element);
      case 'table':
        return this.buildTable(element);
      case 'list':
        return this.buildList(element);
      case 'function-table':
        return this.directiveBuilder.buildFunctionTable(element);
      case 'terms-table':
        return this.directiveBuilder.buildTermsTable(element);
      case 'changes-table':
        return this.directiveBuilder.buildChangesTable(element);
      case 'note':
        return this.directiveBuilder.buildNote(element);
      default:
        return `<!-- UNRECOGNIZED: ${element.type} -->`;
    }
  }

  buildParagraph(element) { /* ... */ }
  buildTable(element) { /* ... */ }
  buildList(element) { /* ... */ }
}
```

### 4.4 DirectiveBuilder

**Файл:** `src/reverse/builder/directive-builder.js`

**Ответственность:** Генерация специальных директив.

```javascript
class DirectiveBuilder {
  /**
   * Строит директиву function-table
   */
  buildFunctionTable(table) {
    const lines = [];

    // Открывающий тег
    const idAttr = table.id ? `{#${table.id}}` : '';
    lines.push(`:::function-table${idAttr}`);

    // Поля
    lines.push(`function: ${table.function}`);
    if (table.task) {
      lines.push(`task: ${table.task}`);
    }
    if (table.taskUrl) {
      lines.push(`taskUrl: ${table.taskUrl}`);
    }
    lines.push(`scenario: |`);

    // Сценарий с отступом
    const scenarioLines = table.scenario.split('\n');
    for (const line of scenarioLines) {
      lines.push(`  ${line}`);
    }

    // Закрывающий тег
    lines.push(':::');

    return lines.join('\n');
  }

  buildTermsTable(table) {
    const lines = [':::terms'];
    lines.push('| Термин | Определение |');
    lines.push('|--------|-------------|');

    for (const row of table.rows) {
      lines.push(`| ${row.term} | ${row.definition} |`);
    }

    lines.push(':::');
    return lines.join('\n');
  }

  buildChangesTable(table) {
    const lines = [':::changes-table'];
    lines.push('| Описание функции «Как есть» | Описание функции «Как будет» |');
    lines.push('|-----------------------------|------------------------------|');

    for (const row of table.rows) {
      lines.push(`| ${row.asIs} | ${row.toBe} |`);
    }

    lines.push(':::');
    return lines.join('\n');
  }

  buildNote(note) {
    return `:::note{type="${note.noteType}"}\n${note.content}\n:::`;
  }

  buildEmptySection() {
    return ':::empty-section\nРаздел не применим для данного документа.\n:::';
  }
}
```

---

## 5. CLI Interface

**Файл:** `src/cli/reverse.js`

```javascript
const { Command } = require('commander');
const { ReverseConverter } = require('../reverse');
const path = require('path');
const fs = require('fs').promises;

function createReverseCommand() {
  const command = new Command('reverse')
    .description('Convert DOCX back to Markdown')
    .argument('<input>', 'Input DOCX file')
    .option('-o, --output <file>', 'Output Markdown file')
    .option('--images-dir <dir>', 'Directory for extracted images', 'images')
    .option('--diff <original>', 'Compare with original Markdown file')
    .option('--strict', 'Strict validation mode', false)
    .option('--no-images', 'Do not extract images')
    .option('--verbose', 'Verbose output', false)
    .option('--format <fmt>', 'Output format: md, json', 'md')
    .action(async (input, options) => {
      try {
        const converter = new ReverseConverter({
          extractImages: options.images !== false,
          imagesDir: options.imagesDir,
          strict: options.strict,
          verbose: options.verbose,
        });

        const result = await converter.convert(input);

        // Определяем выходной файл
        const outputFile = options.output ||
          input.replace(/\.docx$/i, '.md');

        if (options.format === 'json') {
          await fs.writeFile(outputFile, JSON.stringify(result, null, 2));
        } else {
          await fs.writeFile(outputFile, result.markdown);
        }

        // Сохраняем изображения
        if (options.images !== false && result.images.length > 0) {
          await converter.saveImages(result.images, options.imagesDir);
        }

        // Режим сравнения
        if (options.diff) {
          const original = await fs.readFile(options.diff, 'utf-8');
          const diff = converter.diff(original, result.markdown);
          console.log(diff);
        }

        console.log(`✓ Converted: ${outputFile}`);
        if (result.warnings.length > 0) {
          console.log(`⚠ Warnings: ${result.warnings.length}`);
          if (options.verbose) {
            result.warnings.forEach(w => console.log(`  - ${w}`));
          }
        }
      } catch (error) {
        console.error(`✗ Error: ${error.message}`);
        process.exit(1);
      }
    });

  return command;
}

module.exports = { createReverseCommand };
```

---

## 6. Алгоритмы распознавания

### 6.1 Распознавание типа таблицы

```
Input: Table element
Output: TableType (terms | changes | function | regular)

1. Извлечь заголовки колонок (первая строка)
2. Если колонок == 2:
   a. Если заголовки содержат "Термин" И "Определение" → terms
   b. Если заголовки содержат "Как есть" И "Как будет" → changes
3. Если первая ячейка содержит "• Функция:" → function
4. Иначе → regular
```

### 6.2 Распознавание пустого раздела

```
Input: Section content
Output: Boolean (isEmpty)

1. Удалить пробельные символы из контента
2. Проверить паттерны:
   - /не применим/i
   - /не требуется/i
   - /отсутствуют/i
   - /нет изменений/i
3. Если контент пуст или матчит паттерн → true
4. Иначе → false
```

### 6.3 Восстановление форматирования сценария

```
Input: Scenario text from table cell
Output: Formatted Markdown

1. Разбить текст на строки
2. Для каждой строки:
   a. Если начинается с числа и точки → нумерованный список
   b. Если начинается с "•", "-", "–" → маркированный список
   c. Если содержит "**...**" → жирный текст
   d. Если это заголовок блока (Предусловия:, Основной сценарий:) → **заголовок**
3. Собрать строки обратно с правильными отступами
```

---

## 7. Обработка ошибок

### 7.1 Уровни ошибок

| Уровень | Описание | Поведение |
|---------|----------|-----------|
| `fatal` | Невозможно продолжить | Прервать конвертацию |
| `error` | Критичная проблема элемента | Пропустить элемент, записать в warnings |
| `warning` | Некритичная проблема | Продолжить, записать в warnings |
| `info` | Информационное сообщение | Записать при verbose режиме |

### 7.2 Типичные ошибки

```javascript
const ERRORS = {
  INVALID_DOCX: 'Файл не является корректным DOCX',
  MISSING_DOCUMENT_XML: 'Отсутствует word/document.xml',
  PARSE_ERROR: 'Ошибка парсинга XML',
  UNKNOWN_STYLE: 'Неизвестный стиль: {styleId}',
  UNRECOGNIZED_TABLE: 'Не удалось распознать тип таблицы',
  MISSING_REQUIRED_FIELD: 'Отсутствует обязательное поле: {field}',
  IMAGE_EXTRACT_ERROR: 'Ошибка извлечения изображения: {imageId}',
};
```

### 7.3 Формат warnings

```javascript
{
  warnings: [
    {
      code: 'UNRECOGNIZED_TABLE',
      message: 'Не удалось распознать тип таблицы',
      location: 'Section 4, element 3',
      context: 'Table with headers: Колонка1, Колонка2',
    }
  ]
}
```

---

## 8. Тестирование

### 8.1 Unit-тесты

```
tests/reverse/
├── reader/
│   ├── docx-reader.test.js
│   ├── xml-parser.test.js
│   └── styles-parser.test.js
├── recognizers/
│   ├── metadata.test.js
│   ├── sections.test.js
│   └── tables/
│       ├── terms-table.test.js
│       ├── changes-table.test.js
│       └── function-table.test.js
└── builder/
    ├── md-builder.test.js
    ├── yaml-builder.test.js
    └── directive-builder.test.js
```

### 8.2 Integration-тесты

```
tests/reverse/integration/
├── round-trip.test.js      # MD → DOCX → MD
├── real-documents.test.js  # Реальные документы
└── edge-cases.test.js      # Граничные случаи
```

### 8.3 Fixtures

```
tests/fixtures/reverse/
├── simple.docx             # Простой документ
├── complex.docx            # Сложный документ со всеми элементами
├── external-edit.docx      # Документ, отредактированный в Word
├── libreoffice.docx        # Документ из LibreOffice
└── expected/
    ├── simple.md
    ├── complex.md
    └── ...
```

---

## 9. План реализации

### Phase 1: Core (MVP)
- [ ] DocxReader: чтение и парсинг DOCX
- [ ] SectionRecognizer: распознавание структуры
- [ ] MdBuilder: базовая генерация Markdown
- [ ] CLI: команда reverse

### Phase 2: Tables
- [ ] TermsTableRecognizer
- [ ] ChangesTableRecognizer
- [ ] FunctionTableRecognizer
- [ ] DirectiveBuilder для таблиц

### Phase 3: Metadata & Images
- [ ] MetadataRecognizer
- [ ] YamlBuilder
- [ ] Извлечение изображений

### Phase 4: Polish
- [ ] Режим diff
- [ ] Strict mode
- [ ] Обработка edge cases
- [ ] Документация

---

## 10. Открытые вопросы

1. **Формат хранения промежуточного AST** — использовать собственный формат или адаптировать существующий (например, mdast)?

2. **Обработка Track Changes** — игнорировать или пытаться извлечь историю изменений?

3. **Кэширование стилей** — нужно ли кэшировать распознанные стили между документами?

4. **Плагинная система** — реализовывать сейчас или отложить?
