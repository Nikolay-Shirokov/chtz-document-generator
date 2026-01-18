# Техническое задание на разработку CHTZ Generator

## 1. Архитектура системы

### 1.1 Общая схема

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CHTZ Generator                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ВХОДНЫЕ ДАННЫЕ                                                        │
│   ══════════════                                                         │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                │
│   │  document.md │   │   images/    │   │  template    │                │
│   │  (Markdown)  │   │   *.png      │   │   .docx      │                │
│   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘                │
│          │                  │                  │                         │
│          ▼                  ▼                  ▼                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                         PARSER MODULE                            │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│   │  │ YAML Parser │  │  MD Parser  │  │  Directive Processor    │  │   │
│   │  │ (gray-matter)│  │  (unified)  │  │  (custom)               │  │   │
│   │  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │   │
│   │         └────────────────┴─────────────────────┘                │   │
│   │                          │                                       │   │
│   │                          ▼                                       │   │
│   │                  ┌───────────────┐                               │   │
│   │                  │   AST Tree    │                               │   │
│   │                  └───────┬───────┘                               │   │
│   └──────────────────────────┼──────────────────────────────────────┘   │
│                              │                                           │
│                              ▼                                           │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                       BUILDER MODULE                             │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│   │  │ MetaBuilder │  │TableBuilder │  │   ContentBuilder        │  │   │
│   │  │ (шапка)     │  │ (таблицы)   │  │   (текст, списки)       │  │   │
│   │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │   │
│   │                          │                                       │   │
│   │                          ▼                                       │   │
│   │                  ┌───────────────┐                               │   │
│   │                  │  XML Content  │                               │   │
│   │                  └───────┬───────┘                               │   │
│   └──────────────────────────┼──────────────────────────────────────┘   │
│                              │                                           │
│                              ▼                                           │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                      ASSEMBLER MODULE                            │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│   │  │ Template    │  │  Image      │  │   Package               │  │   │
│   │  │ Unpacker    │  │  Processor  │  │   Creator               │  │   │
│   │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │   │
│   └──────────────────────────┬──────────────────────────────────────┘   │
│                              │                                           │
│                              ▼                                           │
│   ВЫХОДНЫЕ ДАННЫЕ                                                       │
│   ═══════════════                                                        │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │                        output.docx                            │      │
│   └──────────────────────────────────────────────────────────────┘      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Структура проекта

```
chtz-generator/
├── package.json
├── README.md
├── bin/
│   └── chtz-generate.js          # CLI entry point
├── src/
│   ├── index.js                  # Главный модуль
│   ├── parser/
│   │   ├── index.js              # Парсер Markdown
│   │   ├── yaml-parser.js        # Парсинг YAML front matter
│   │   ├── md-parser.js          # Парсинг Markdown в AST
│   │   └── directives.js         # Обработка директив
│   ├── builders/
│   │   ├── index.js              # Экспорт всех билдеров
│   │   ├── document-builder.js   # Сборка document.xml
│   │   ├── meta-builder.js       # Шапка документа
│   │   ├── history-builder.js    # Таблица истории
│   │   ├── terms-builder.js      # Таблица терминов
│   │   ├── function-table-builder.js  # Функциональные таблицы
│   │   ├── changes-builder.js    # Таблица изменений
│   │   ├── content-builder.js    # Текст, списки, параграфы
│   │   ├── table-builder.js      # Обычные таблицы
│   │   └── image-builder.js      # Изображения
│   ├── assembler/
│   │   ├── index.js              # Сборка docx
│   │   ├── template-handler.js   # Работа с шаблоном
│   │   ├── relationships.js      # Управление связями
│   │   └── content-types.js      # Content_Types.xml
│   ├── styles/
│   │   └── gpn-styles.js         # Конфигурация стилей
│   └── utils/
│       ├── xml-utils.js          # XML-утилиты
│       ├── file-utils.js         # Работа с файлами
│       └── validators.js         # Валидация
├── templates/
│   └── gpn-template.docx         # Шаблон документа
├── examples/
│   ├── simple/
│   │   ├── document.md
│   │   └── images/
│   └── full/
│       ├── document.md
│       └── images/
├── tests/
│   ├── parser.test.js
│   ├── builders.test.js
│   └── integration.test.js
└── docs/
    ├── 01-REQUIREMENTS.md
    ├── 02-TECHNICAL-SPEC.md
    ├── 03-IMPLEMENTATION-PLAN.md
    ├── 04-USER-GUIDE.md
    ├── 05-MARKDOWN-REFERENCE.md
    └── 06-AI-PROMPT.md
```

---

## 2. Компоненты системы

### 2.1 Parser Module

#### 2.1.1 YAML Parser (`yaml-parser.js`)

**Назначение**: Извлечение и валидация метаданных из YAML front matter.

**Интерфейс**:
```javascript
/**
 * Парсит YAML front matter из Markdown файла
 * @param {string} content - Содержимое файла
 * @returns {Object} { metadata, history, relatedDocs, content }
 */
function parseYaml(content) { }
```

**Валидация**:
- Обязательные поля: `type`, `metadata.shortName`, `metadata.consultant`
- Формат дат: `DD.MM.YYYY`
- Типы данных: arrays, strings, booleans

#### 2.1.2 Markdown Parser (`md-parser.js`)

**Назначение**: Преобразование Markdown в AST (Abstract Syntax Tree).

**Зависимости**:
- `unified` - платформа обработки текста
- `remark-parse` - парсер Markdown
- `remark-gfm` - поддержка GFM-таблиц
- `remark-directive` - поддержка директив

**Интерфейс**:
```javascript
/**
 * Парсит Markdown контент в AST
 * @param {string} markdown - Markdown текст (без YAML)
 * @returns {Object} AST дерево
 */
async function parseMarkdown(markdown) { }
```

#### 2.1.3 Directive Processor (`directives.js`)

**Назначение**: Обработка специальных блоков `:::directive`.

**Поддерживаемые директивы**:

| Директива | Описание | Атрибуты |
|-----------|----------|----------|
| `:::terms` | Таблица терминов | - |
| `:::changes-table` | Таблица "как есть/как будет" | - |
| `:::function-table` | Функциональная таблица ЧТЗ | `#id`, `function`, `task`, `taskUrl`, `scenario` |
| `:::note` | Информационный блок | `type`: info, warning, danger |
| `:::empty-section` | Пустой раздел | - |

**Интерфейс**:
```javascript
/**
 * Обрабатывает директиву и возвращает структуру данных
 * @param {Object} node - AST узел директивы
 * @returns {Object} Структурированные данные директивы
 */
function processDirective(node) { }
```

### 2.2 Builder Module

#### 2.2.1 Document Builder (`document-builder.js`)

**Назначение**: Сборка полного document.xml из компонентов.

**Интерфейс**:
```javascript
/**
 * Собирает document.xml
 * @param {Object} parsedData - Данные от парсера
 * @param {Object} styles - Конфигурация стилей
 * @returns {string} XML-строка document.xml
 */
function buildDocument(parsedData, styles) { }
```

**Порядок сборки**:
1. XML заголовок и пространства имён
2. Шапка документа (метаданные)
3. История изменений
4. Связанные документы
5. Разделы контента
6. Секция настроек страницы (sectPr)

#### 2.2.2 Meta Builder (`meta-builder.js`)

**Назначение**: Генерация таблицы метаданных (шапка ЧТЗ).

**Структура выходной таблицы**:
```
┌─────────────────────────┬─────────────────────────┬─────────┬────────────────────┐
│ Общее описание изменения│                         │         │                    │
├─────────────────────────┼─────────────────────────┼─────────┼────────────────────┤
│ Краткое название        │ [shortName]             │         │                    │
├─────────────────────────┼─────────────────────────┼─────────┼────────────────────┤
│ Консультант:            │ [name]                  │ E-mail: │ [email]            │
├─────────────────────────┼─────────────────────────┼─────────┼────────────────────┤
│ Наименование организации│ [organization]          │         │                    │
├─────────────────────────┼─────────────────────────┼─────────┼────────────────────┤
│ ИТ-решения (ЕСИС)       │ [itSolutions]           │         │                    │
├─────────────────────────┼─────────────────────────┼─────────┼────────────────────┤
│ ИТ-системы (ЕСИС)       │ [itSystems]             │         │                    │
├─────────────────────────┼─────────────────────────┼─────────┼────────────────────┤
│ Обработка данных КТ     │ [processKT: Да/Нет]     │         │                    │
├─────────────────────────┼─────────────────────────┼─────────┼────────────────────┤
│ Обработка данных ПДн    │ [processPDn: Да/Нет]    │         │                    │
├─────────────────────────┼─────────────────────────┼─────────┼────────────────────┤
│ Дата создания ЧТЗ:      │ [createdDate]           │         │                    │
└─────────────────────────┴─────────────────────────┴─────────┴────────────────────┘
```

#### 2.2.3 Function Table Builder (`function-table-builder.js`)

**Назначение**: Генерация функциональных таблиц — основного элемента ЧТЗ.

**Структура**:
```
┌─────────┬──────────────────────────────────────────────────────────────────┐
│ Функция │ • Описание функции                                              │
├─────────┼──────────────────────────────────────────────────────────────────┤
│ № задачи│ [TASK-123](https://...)                                         │
│ в ФТТ   │                                                                  │
├─────────┼──────────────────────────────────────────────────────────────────┤
│ Сценарий│ Описание сценария с:                                            │
│         │ - Маркированными списками                                        │
│         │ - Нумерованными списками                                         │
│         │   1. Вложенными элементами                                       │
│         │      - Ещё глубже                                                │
│         │ - **Жирным текстом**                                             │
│         │ - Изображениями                                                  │
│         │ - Таблицами внутри                                               │
└─────────┴──────────────────────────────────────────────────────────────────┘
```

#### 2.2.4 Content Builder (`content-builder.js`)

**Назначение**: Генерация XML для текстового контента.

**Поддерживаемые элементы**:

| AST-тип | XML-результат |
|---------|---------------|
| `heading` | `<w:p><w:pPr><w:pStyle w:val="1"/></w:pPr>...` |
| `paragraph` | `<w:p><w:r><w:t>text</w:t></w:r></w:p>` |
| `strong` | `<w:r><w:rPr><w:b/></w:rPr><w:t>text</w:t></w:r>` |
| `emphasis` | `<w:r><w:rPr><w:i/></w:rPr><w:t>text</w:t></w:r>` |
| `list` | `<w:p><w:pPr><w:numPr>...</w:numPr></w:pPr>...` |
| `link` | `<w:hyperlink r:id="rIdN">...` |

#### 2.2.5 Table Builder (`table-builder.js`)

**Назначение**: Генерация XML для таблиц.

**Параметры стилизации**:
```javascript
{
  headerBackground: "D9E2F3",  // Цвет заголовка
  borderColor: "000000",        // Цвет границ
  borderWidth: 1,               // Толщина границ
  cellPadding: {
    top: 80,
    bottom: 80,
    left: 120,
    right: 120
  }
}
```

#### 2.2.6 Image Builder (`image-builder.js`)

**Назначение**: Генерация XML для изображений.

**Функции**:
- Чтение файла изображения
- Определение размеров (из атрибутов или автоматически)
- Генерация уникального relationship ID
- Создание `<w:drawing>` элемента

### 2.3 Assembler Module

#### 2.3.1 Template Handler (`template-handler.js`)

**Назначение**: Работа с docx-шаблоном.

**Функции**:
```javascript
/**
 * Распаковывает шаблон во временную директорию
 * @param {string} templatePath - Путь к шаблону
 * @returns {string} Путь к распакованной директории
 */
async function unpackTemplate(templatePath) { }

/**
 * Извлекает конфигурацию стилей из шаблона
 * @param {string} unpackedPath - Путь к распакованному шаблону
 * @returns {Object} Конфигурация стилей
 */
function extractStyles(unpackedPath) { }
```

#### 2.3.2 Relationships Manager (`relationships.js`)

**Назначение**: Управление файлом document.xml.rels.

**Функции**:
```javascript
/**
 * Добавляет связь для изображения
 * @param {string} imagePath - Путь к изображению в media/
 * @returns {string} Сгенерированный rId
 */
function addImageRelationship(imagePath) { }

/**
 * Добавляет внешнюю гиперссылку
 * @param {string} url - URL ссылки
 * @returns {string} Сгенерированный rId
 */
function addHyperlinkRelationship(url) { }

/**
 * Генерирует XML для relationships
 * @returns {string} XML-строка
 */
function generateXml() { }
```

#### 2.3.3 Package Creator (`index.js` в assembler)

**Назначение**: Финальная сборка docx файла.

**Алгоритм**:
1. Распаковать шаблон
2. Заменить `word/document.xml`
3. Обновить `word/_rels/document.xml.rels`
4. Добавить изображения в `word/media/`
5. Обновить `[Content_Types].xml` (если нужно)
6. Запаковать в ZIP с расширением .docx

---

## 3. Конфигурация стилей

### 3.1 Файл gpn-styles.js

```javascript
module.exports = {
  // Идентификаторы стилей (из styles.xml шаблона)
  styleIds: {
    heading1: "1",
    heading2: "2", 
    heading3: "3",
    normal: "a",
    tableHeader: "af6",
    listParagraph: "a6",
    hyperlink: "af2"
  },
  
  // Идентификаторы нумерации (из numbering.xml шаблона)
  numberingIds: {
    bullet: "1",
    decimal: "2",
    headingNumbering: "3"
  },
  
  // Параметры страницы (в twips, 1440 = 1 дюйм)
  page: {
    width: 11906,   // A4
    height: 16838,
    margins: {
      top: 1134,
      bottom: 1134,
      left: 1701,
      right: 850
    }
  },
  
  // Цвета
  colors: {
    accent: "0070C0",
    headerBackground: "0070C0",
    tableHeaderBackground: "D9E2F3",
    tableBorder: "000000",
    hyperlink: "0563C1"
  },
  
  // Шрифты
  fonts: {
    heading: "Arial",
    body: "Times New Roman",
    code: "Courier New"
  },
  
  // Размеры шрифтов (в half-points)
  fontSizes: {
    heading1: 32,  // 16pt
    heading2: 28,  // 14pt
    heading3: 26,  // 13pt
    normal: 24,    // 12pt
    small: 20      // 10pt
  }
};
```

---

## 4. CLI интерфейс

### 4.1 Команда генерации

```bash
chtz-generate <input> [options]

Arguments:
  input                    Путь к Markdown файлу

Options:
  -o, --output <path>      Путь для выходного файла (default: input.docx)
  -t, --template <path>    Путь к шаблону (default: встроенный)
  -i, --images <dir>       Директория с изображениями (default: ./images)
  -v, --verbose            Подробный вывод
  --validate-only          Только валидация, без генерации
  -h, --help               Показать справку
  -V, --version            Показать версию
```

### 4.2 Примеры использования

```bash
# Базовое использование
chtz-generate document.md

# С указанием выходного файла
chtz-generate document.md -o ЧТЗ_Проект.docx

# С кастомным шаблоном
chtz-generate document.md -t ./my-template.docx

# Только валидация
chtz-generate document.md --validate-only

# Подробный вывод
chtz-generate document.md -v
```

---

## 5. Обработка ошибок

### 5.1 Коды ошибок

| Код | Название | Описание |
|-----|----------|----------|
| E001 | YAML_PARSE_ERROR | Ошибка парсинга YAML |
| E002 | YAML_VALIDATION_ERROR | Отсутствуют обязательные поля |
| E003 | MD_PARSE_ERROR | Ошибка парсинга Markdown |
| E004 | DIRECTIVE_ERROR | Некорректная директива |
| E005 | IMAGE_NOT_FOUND | Изображение не найдено |
| E006 | TEMPLATE_ERROR | Ошибка работы с шаблоном |
| E007 | BUILD_ERROR | Ошибка сборки документа |
| E008 | IO_ERROR | Ошибка чтения/записи файла |

### 5.2 Формат сообщений об ошибках

```
[ERROR] E002: Отсутствует обязательное поле
  Файл: document.md
  Поле: metadata.consultant.name
  
  Добавьте поле в YAML front matter:
  
  metadata:
    consultant:
      name: "ФИО консультанта"  # <-- добавьте это
```

---

## 6. Зависимости

### 6.1 Production зависимости

```json
{
  "dependencies": {
    "unified": "^11.0.0",
    "remark-parse": "^11.0.0",
    "remark-gfm": "^4.0.0",
    "remark-directive": "^3.0.0",
    "gray-matter": "^4.0.3",
    "adm-zip": "^0.5.10",
    "commander": "^11.0.0",
    "chalk": "^5.3.0"
  }
}
```

### 6.2 Dev зависимости

```json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "eslint": "^8.0.0"
  }
}
```

---

## 7. Тестирование

### 7.1 Unit-тесты

- `parser.test.js` — тесты парсера
- `builders.test.js` — тесты билдеров
- `validators.test.js` — тесты валидации

### 7.2 Интеграционные тесты

- Генерация простого документа
- Генерация документа со всеми элементами
- Обработка ошибок

### 7.3 Ручное тестирование

- Открытие в Word
- Проверка форматирования
- Сравнение с эталоном
