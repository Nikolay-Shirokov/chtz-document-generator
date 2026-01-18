/**
 * Конфигурация корпоративных стилей для документов ЧТЗ
 * StyleIds извлечены из эталонного шаблона gpn-template.docx
 */

module.exports = {
  // Идентификаторы стилей параграфов (styleId из styles.xml шаблона)
  styleIds: {
    // Заголовки
    heading1: "1",          // heading 1 - Arial, 16pt, bold
    heading2: "2",          // heading 2 - Arial, 14pt, bold
    heading3: "3",          // heading 3 - Arial, 13pt, bold
    heading4: "4",          // heading 4
    heading5: "5",          // heading 5
    
    // Текст
    normal: "a",            // Normal - 12pt
    title: "af6",           // Title - Arial, 16pt, bold
    
    // Списки
    listParagraph: "aff2",  // List Paragraph
    
    // Ссылки
    hyperlink: "aff5",      // Hyperlink - color=#0000FF
    
    // Таблицы
    tableGrid: "afa",       // Table Grid
    
    // Цитаты
    quote: "21",            // Quote
    intenseQuote: "a6",     // Intense Quote
    
    // Оглавление
    toc1: "12",
    toc2: "24", 
    toc3: "32"
  },
  
  // Идентификаторы нумерации (numId из numbering.xml)
  numberingIds: {
    bullet: "1",            // Маркированный список
    decimal: "2"            // Нумерованный список
  },
  
  // Параметры страницы (в twips, 1440 twips = 1 дюйм = 2.54 см)
  page: {
    width: 11906,           // Ширина A4 (210 мм)
    height: 16838,          // Высота A4 (297 мм)
    margins: {
      top: 1134,            // Верхнее поле (~2 см)
      bottom: 1134,         // Нижнее поле (~2 см)
      left: 1701,           // Левое поле (~3 см)
      right: 850,           // Правое поле (~1.5 см)
      header: 708,
      footer: 708
    }
  },
  
  // Цвета (hex без #)
  colors: {
    accent: "0072C6",               // Акцентный синий (корпоративный)
    headerBackground: "0072C6",     // Фон заголовка в колонтитуле
    tableHeaderBackground: "0072C6", // Фон заголовка таблицы (яркий синий)
    tableHeaderText: "FFFFFF",       // Белый текст заголовка
    tableBorder: "000000",          // Цвет границ таблицы
    hyperlink: "0563C1",            // Цвет гиперссылки
    warning: "FFF3CD",              // Фон предупреждения
    warningBorder: "FFECB5"         // Граница предупреждения
  },
  
  // Шрифты (из шаблона)
  fonts: {
    heading: "Arial",
    body: "Times New Roman",
    code: "Courier New"
  },
  
  // Размеры шрифтов (в half-points, 24 = 12pt)
  // Эти значения используются только если нужно override стиля
  fontSizes: {
    heading1: 32,                   // 16pt
    heading2: 28,                   // 14pt
    heading3: 26,                   // 13pt
    normal: 24,                     // 12pt
    small: 20,                      // 10pt
    tableHeader: 22                 // 11pt
  },
  
  // Отступы (в twips) - используются только при необходимости
  spacing: {
    beforeHeading1: 240,
    afterHeading1: 60,
    beforeHeading2: 240,
    afterHeading2: 60,
    beforeParagraph: 0,
    afterParagraph: 120,
    lineSpacing: 276
  },
  
  // Параметры списков (в twips)
  list: {
    indent: 720,
    hanging: 360
  },
  
  // Параметры таблиц
  table: {
    borderWidth: 4,
    cellPadding: {
      top: 80,
      bottom: 80,
      left: 120,
      right: 120
    }
  },
  
  // Relationship IDs в шаблоне
  templateRels: {
    theme: "rId8",
    startImageId: 9
  }
};
