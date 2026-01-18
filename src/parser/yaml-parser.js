/**
 * YAML Parser - парсинг и валидация YAML front matter
 */

const matter = require('gray-matter');

/**
 * Ошибка валидации YAML
 */
class YamlValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'YamlValidationError';
    this.field = field;
  }
}

/**
 * Схема обязательных полей
 */
const REQUIRED_FIELDS = [
  'type',
  'metadata.shortName',
  'metadata.consultant.name',
  'metadata.organization'
];

/**
 * Получение значения по пути (например, 'metadata.consultant.name')
 * @param {Object} obj - Объект
 * @param {string} path - Путь к полю
 * @returns {*} Значение
 */
function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => acc && acc[key], obj);
}

/**
 * Валидация данных YAML
 * @param {Object} data - Данные из YAML
 * @throws {YamlValidationError}
 */
function validateYaml(data) {
  // Проверка обязательных полей
  for (const field of REQUIRED_FIELDS) {
    const value = getByPath(data, field);
    if (value === undefined || value === null || value === '') {
      throw new YamlValidationError(
        `Отсутствует обязательное поле: ${field}`,
        field
      );
    }
  }
  
  // Проверка типа документа
  if (data.type !== 'chtz') {
    throw new YamlValidationError(
      `Неверный тип документа: ${data.type}. Ожидается: chtz`,
      'type'
    );
  }
  
  // Проверка формата даты
  if (data.metadata.createdDate) {
    const datePattern = /^\d{2}\.\d{2}\.\d{4}$/;
    if (!datePattern.test(data.metadata.createdDate)) {
      throw new YamlValidationError(
        `Неверный формат даты: ${data.metadata.createdDate}. Ожидается: DD.MM.YYYY`,
        'metadata.createdDate'
      );
    }
  }
  
  // Проверка истории изменений
  if (data.history && Array.isArray(data.history)) {
    data.history.forEach((item, index) => {
      if (!item.version) {
        throw new YamlValidationError(
          `Отсутствует версия в истории изменений [${index}]`,
          `history[${index}].version`
        );
      }
      if (!item.date) {
        throw new YamlValidationError(
          `Отсутствует дата в истории изменений [${index}]`,
          `history[${index}].date`
        );
      }
    });
  }
  
  // Проверка связанных документов
  if (data.relatedDocs && Array.isArray(data.relatedDocs)) {
    data.relatedDocs.forEach((doc, index) => {
      if (!doc.name) {
        throw new YamlValidationError(
          `Отсутствует название связанного документа [${index}]`,
          `relatedDocs[${index}].name`
        );
      }
    });
  }
}

/**
 * Нормализация данных (приведение к единому формату)
 * @param {Object} data - Данные из YAML
 * @returns {Object} Нормализованные данные
 */
function normalizeData(data) {
  const normalized = { ...data };
  
  // Нормализация metadata
  normalized.metadata = {
    shortName: '',
    consultant: { name: '', email: '' },
    organization: '',
    itSolutions: [],
    itSystems: [],
    processKT: false,
    processPDn: false,
    createdDate: '',
    ...data.metadata
  };
  
  // Преобразование строк в массивы для itSolutions и itSystems
  if (typeof normalized.metadata.itSolutions === 'string') {
    normalized.metadata.itSolutions = [normalized.metadata.itSolutions];
  }
  if (typeof normalized.metadata.itSystems === 'string') {
    normalized.metadata.itSystems = [normalized.metadata.itSystems];
  }
  
  // Нормализация истории
  normalized.history = data.history || [];
  
  // Нормализация связанных документов
  normalized.relatedDocs = data.relatedDocs || [];
  
  // Версия документа
  normalized.version = data.version || '1.0';
  
  return normalized;
}

/**
 * Парсит YAML front matter из содержимого файла
 * @param {string} fileContent - Содержимое файла
 * @param {Object} options - Опции
 * @param {boolean} options.validate - Валидировать данные (default: true)
 * @returns {Object} { data, content }
 */
function parseYaml(fileContent, options = {}) {
  const { validate = true } = options;
  
  // Парсинг с помощью gray-matter
  const parsed = matter(fileContent);
  
  if (!parsed.data || Object.keys(parsed.data).length === 0) {
    throw new YamlValidationError(
      'YAML front matter не найден. Убедитесь, что файл начинается с ---',
      'yaml'
    );
  }
  
  // Валидация
  if (validate) {
    validateYaml(parsed.data);
  }
  
  // Нормализация
  const normalizedData = normalizeData(parsed.data);
  
  return {
    data: normalizedData,
    content: parsed.content.trim()
  };
}

/**
 * Форматирует сообщение об ошибке с подсказкой
 * @param {YamlValidationError} error
 * @returns {string}
 */
function formatValidationError(error) {
  const hints = {
    'type': `Добавьте в начало YAML:\n  type: chtz`,
    'metadata.shortName': `Добавьте:\n  metadata:\n    shortName: "Название изменения"`,
    'metadata.consultant.name': `Добавьте:\n  metadata:\n    consultant:\n      name: "ФИО консультанта"`,
    'metadata.organization': `Добавьте:\n  metadata:\n    organization: "Название организации"`,
    'metadata.createdDate': `Используйте формат DD.MM.YYYY:\n  metadata:\n    createdDate: "01.01.2025"`
  };
  
  let message = `[ОШИБКА] ${error.message}`;
  
  if (error.field && hints[error.field]) {
    message += `\n\nПодсказка:\n${hints[error.field]}`;
  }
  
  return message;
}

module.exports = {
  parseYaml,
  validateYaml,
  normalizeData,
  formatValidationError,
  YamlValidationError
};
