/**
 * DocumentValidator - валидатор структуры документа ЧТЗ
 * Проверяет соответствие документа требованиям CHTZ
 */

class DocumentValidator {
  constructor(options = {}) {
    this.strict = options.strict || false;
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Валидирует распознанную структуру документа
   * @param {RecognizedDocument} recognized - результат распознавания
   * @returns {{valid: boolean, errors: Array, warnings: Array}}
   */
  validate(recognized) {
    this.errors = [];
    this.warnings = [];

    // Валидация метаданных
    this.validateMetadata(recognized.metadata);

    // Валидация истории
    this.validateHistory(recognized.history);

    // Валидация структуры разделов (10 обязательных разделов)
    if (this.strict) {
      this.validateSections(recognized.sections);
    }

    // Валидация изображений
    this.validateImages(recognized.images);

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  /**
   * Валидирует метаданные
   */
  validateMetadata(metadata) {
    if (!metadata) {
      this.addError('METADATA_MISSING', 'Метаданные документа отсутствуют');
      return;
    }

    // Обязательные поля (FR-02.2)
    const requiredFields = {
      shortName: 'Краткое название (shortName)',
      organization: 'Организация (organization)',
      createdDate: 'Дата создания (createdDate)'
    };

    for (const [field, label] of Object.entries(requiredFields)) {
      if (!metadata[field] || metadata[field].trim() === '') {
        if (this.strict) {
          this.addError('METADATA_REQUIRED_FIELD', `Не заполнено обязательное поле: ${label}`);
        } else {
          this.addWarning('METADATA_REQUIRED_FIELD', `Рекомендуется заполнить поле: ${label}`);
        }
      }
    }

    // Проверка консультанта
    if (!metadata.consultant) {
      if (this.strict) {
        this.addError('METADATA_CONSULTANT_MISSING', 'Информация о консультанте отсутствует');
      } else {
        this.addWarning('METADATA_CONSULTANT_MISSING', 'Рекомендуется указать консультанта');
      }
    } else {
      if (!metadata.consultant.name || metadata.consultant.name.trim() === '' || metadata.consultant.name === 'Неизвестно') {
        if (this.strict) {
          this.addError('METADATA_CONSULTANT_NAME', 'Не указано имя консультанта');
        } else {
          this.addWarning('METADATA_CONSULTANT_NAME', 'Рекомендуется указать имя консультанта');
        }
      }

      // Email - только предупреждение
      if (!metadata.consultant.email || metadata.consultant.email.trim() === '') {
        this.addWarning('METADATA_CONSULTANT_EMAIL', 'Не указан email консультанта');
      }
    }

    // Проверка формата даты (DD.MM.YYYY)
    if (metadata.createdDate) {
      const datePattern = /^\d{2}\.\d{2}\.\d{4}$/;
      if (!datePattern.test(metadata.createdDate)) {
        this.addWarning('METADATA_DATE_FORMAT', `Дата создания имеет нестандартный формат: ${metadata.createdDate} (ожидается DD.MM.YYYY)`);
      }
    }
  }

  /**
   * Валидирует историю изменений
   */
  validateHistory(history) {
    if (!history || history.length === 0) {
      if (this.strict) {
        this.addError('HISTORY_MISSING', 'История изменений документа отсутствует');
      } else {
        this.addWarning('HISTORY_MISSING', 'Рекомендуется добавить историю изменений');
      }
      return;
    }

    // Проверяем каждую запись истории
    for (let i = 0; i < history.length; i++) {
      const entry = history[i];

      if (!entry.version || entry.version.trim() === '') {
        this.addWarning('HISTORY_VERSION_MISSING', `Запись истории #${i + 1}: не указана версия`);
      }

      if (!entry.date || entry.date.trim() === '') {
        this.addWarning('HISTORY_DATE_MISSING', `Запись истории #${i + 1}: не указана дата`);
      }

      if (!entry.comment || entry.comment.trim() === '') {
        this.addWarning('HISTORY_COMMENT_MISSING', `Запись истории #${i + 1}: не указан комментарий`);
      }
    }
  }

  /**
   * Валидирует структуру разделов (FR-04.2 - 10 обязательных разделов)
   */
  validateSections(sections) {
    if (!sections || sections.length === 0) {
      this.addError('SECTIONS_MISSING', 'Разделы документа отсутствуют');
      return;
    }

    // 10 обязательных разделов ЧТЗ
    const requiredSections = [
      { pattern: /^\d+\.\s*(Термины и определения|Глоссарий)/i, name: '1. Термины и определения' },
      { pattern: /^\d+\.\s*Исходные данные задания/i, name: '2. Исходные данные задания' },
      { pattern: /^\d+\.\s*Изменение функционала системы/i, name: '3. Изменение функционала системы' },
      { pattern: /^\d+\.\s*Описание изменений в ИТ[- ]?системе/i, name: '4. Описание изменений в ИТ-системе' },
      { pattern: /^\d+\.\s*Описание изменений в интеграционных механизмах/i, name: '5. Описание изменений в интеграционных механизмах' },
      { pattern: /^\d+\.\s*Описание изменений.*ПДн/i, name: '6. Описание изменений, состава обрабатываемых ПДн' },
      { pattern: /^\d+\.\s*Входные формы/i, name: '7. Входные формы' },
      { pattern: /^\d+\.\s*Выходные формы/i, name: '8. Выходные формы' },
      { pattern: /^\d+\.\s*Описание изменений в ролевой модели/i, name: '9. Описание изменений в ролевой модели' },
      { pattern: /^\d+\.\s*Приложени[яе]/i, name: '10. Приложения' }
    ];

    const foundSections = new Set();

    // Проверяем наличие каждого обязательного раздела
    for (const section of sections) {
      if (section.level === 1 && section.title) {
        for (let i = 0; i < requiredSections.length; i++) {
          if (requiredSections[i].pattern.test(section.title)) {
            foundSections.add(i);
          }
        }
      }
    }

    // Собираем отсутствующие разделы
    const missingSections = [];
    for (let i = 0; i < requiredSections.length; i++) {
      if (!foundSections.has(i)) {
        missingSections.push(requiredSections[i].name);
      }
    }

    if (missingSections.length > 0) {
      this.addError(
        'SECTIONS_REQUIRED_MISSING',
        `Отсутствуют обязательные разделы (${missingSections.length}):\n  - ${missingSections.join('\n  - ')}`
      );
    }

    // Проверяем наличие подразделов в ключевых разделах
    const sectionsWithSubsections = sections.filter(s => s.level === 1);
    if (sectionsWithSubsections.length > 0) {
      for (const section of sectionsWithSubsections) {
        // Проверяем, что у раздела "Исходные данные задания" есть подразделы
        if (/^\d+\.\s*Исходные данные задания/i.test(section.title)) {
          const hasSubsections = sections.some(s =>
            s.level === 2 && s.parent === section.id
          );
          if (!hasSubsections) {
            this.addWarning(
              'SECTION_NO_SUBSECTIONS',
              `Раздел "${section.title}" обычно содержит подразделы (2.1 Бизнес-цель, 2.2 Текущая ситуация и т.д.)`
            );
          }
        }
      }
    }
  }

  /**
   * Валидирует изображения
   */
  validateImages(images) {
    if (!images) return;

    for (let i = 0; i < images.length; i++) {
      const img = images[i];

      if (!img.filename) {
        this.addWarning('IMAGE_NO_FILENAME', `Изображение #${i + 1}: отсутствует имя файла`);
      }

      if (!img.contentType) {
        this.addWarning('IMAGE_NO_CONTENT_TYPE', `Изображение "${img.filename}": не определён тип содержимого`);
      }

      if (!img.data || img.data.length === 0) {
        this.addError('IMAGE_EMPTY', `Изображение "${img.filename}": нет данных`);
      }
    }
  }

  /**
   * Добавляет ошибку
   */
  addError(code, message) {
    this.errors.push({ code, message, severity: 'error' });
  }

  /**
   * Добавляет предупреждение
   */
  addWarning(code, message) {
    this.warnings.push({ code, message, severity: 'warning' });
  }
}

module.exports = { DocumentValidator };
