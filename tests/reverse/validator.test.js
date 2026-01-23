/**
 * Тесты для DocumentValidator
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { DocumentValidator } = require('../../src/reverse/validator');

// Metadata validation tests
test('Validator should pass with complete metadata', () => {
  const validator = new DocumentValidator({ strict: false });
  const recognized = {
    metadata: {
      shortName: 'Test Document',
      consultant: {
        name: 'John Doe',
        email: 'john@example.com'
      },
      organization: 'Test Org',
      createdDate: '23.01.2026'
    },
    history: [{ version: '1.0', date: '23.01.2026', comment: 'Initial', author: 'John' }],
    sections: [],
    images: []
  };

  const result = validator.validate(recognized);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
});

test('Validator should warn about missing consultant name in non-strict mode', () => {
  const validator = new DocumentValidator({ strict: false });
  const recognized = {
    metadata: {
      shortName: 'Test',
      consultant: { name: 'Неизвестно', email: '' },
      organization: 'Test Org',
      createdDate: '23.01.2026'
    },
    history: [],
    sections: [],
    images: []
  };

  const result = validator.validate(recognized);
  assert.ok(result.warnings.some(w => w.code === 'METADATA_CONSULTANT_NAME'));
});

test('Validator should error on missing consultant name in strict mode', () => {
  const validator = new DocumentValidator({ strict: true });
  const recognized = {
    metadata: {
      shortName: 'Test',
      consultant: { name: '', email: '' },
      organization: 'Test Org',
      createdDate: '23.01.2026'
    },
    history: [],
    sections: [],
    images: []
  };

  const result = validator.validate(recognized);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.code === 'METADATA_CONSULTANT_NAME'));
});

test('Validator should warn about invalid date format', () => {
  const validator = new DocumentValidator({ strict: false });
  const recognized = {
    metadata: {
      shortName: 'Test',
      consultant: { name: 'John', email: 'john@example.com' },
      organization: 'Test Org',
      createdDate: '2026-01-23'  // Wrong format
    },
    history: [],
    sections: [],
    images: []
  };

  const result = validator.validate(recognized);
  assert.ok(result.warnings.some(w => w.code === 'METADATA_DATE_FORMAT'));
});

// Sections validation tests
test('Validator should detect missing mandatory sections in strict mode', () => {
  const validator = new DocumentValidator({ strict: true });
  const recognized = {
    metadata: {
      shortName: 'Test',
      consultant: { name: 'John', email: 'john@example.com' },
      organization: 'Test Org',
      createdDate: '23.01.2026'
    },
    history: [{ version: '1.0', date: '23.01.2026', comment: 'Test', author: 'John' }],
    sections: [
      { id: '1', level: 1, title: '1. Термины и определения' },
      { id: '2', level: 1, title: '2. Исходные данные задания' }
      // Missing 8 other mandatory sections
    ],
    images: []
  };

  const result = validator.validate(recognized);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.code === 'SECTIONS_REQUIRED_MISSING'));
});

test('Validator should pass with all 10 mandatory sections', () => {
  const validator = new DocumentValidator({ strict: true });
  const recognized = {
    metadata: {
      shortName: 'Test',
      consultant: { name: 'John', email: 'john@example.com' },
      organization: 'Test Org',
      createdDate: '23.01.2026'
    },
    history: [{ version: '1.0', date: '23.01.2026', comment: 'Test', author: 'John' }],
    sections: [
      { id: '1', level: 1, title: '1. Термины и определения' },
      { id: '2', level: 1, title: '2. Исходные данные задания' },
      { id: '3', level: 1, title: '3. Изменение функционала системы' },
      { id: '4', level: 1, title: '4. Описание изменений в ИТ-системе' },
      { id: '5', level: 1, title: '5. Описание изменений в интеграционных механизмах' },
      { id: '6', level: 1, title: '6. Описание изменений, состава обрабатываемых ПДн' },
      { id: '7', level: 1, title: '7. Входные формы' },
      { id: '8', level: 1, title: '8. Выходные формы' },
      { id: '9', level: 1, title: '9. Описание изменений в ролевой модели' },
      { id: '10', level: 1, title: '10. Приложения' }
    ],
    images: []
  };

  const result = validator.validate(recognized);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
});

// History validation tests
test('Validator should warn about missing history in non-strict mode', () => {
  const validator = new DocumentValidator({ strict: false });
  const recognized = {
    metadata: {
      shortName: 'Test',
      consultant: { name: 'John', email: 'john@example.com' },
      organization: 'Test Org',
      createdDate: '23.01.2026'
    },
    history: [],
    sections: [],
    images: []
  };

  const result = validator.validate(recognized);
  assert.ok(result.warnings.some(w => w.code === 'HISTORY_MISSING'));
});

test('Validator should error about missing history in strict mode', () => {
  const validator = new DocumentValidator({ strict: true });
  const recognized = {
    metadata: {
      shortName: 'Test',
      consultant: { name: 'John', email: 'john@example.com' },
      organization: 'Test Org',
      createdDate: '23.01.2026'
    },
    history: [],
    sections: [],
    images: []
  };

  const result = validator.validate(recognized);
  assert.ok(result.errors.some(e => e.code === 'HISTORY_MISSING'));
});

// Images validation tests
test('Validator should error on empty image data', () => {
  const validator = new DocumentValidator({ strict: false });
  const recognized = {
    metadata: {
      shortName: 'Test',
      consultant: { name: 'John', email: 'john@example.com' },
      organization: 'Test Org',
      createdDate: '23.01.2026'
    },
    history: [{ version: '1.0', date: '23.01.2026', comment: 'Test', author: 'John' }],
    sections: [],
    images: [
      { filename: 'test.png', contentType: 'image/png', data: Buffer.from([]) }
    ]
  };

  const result = validator.validate(recognized);
  assert.ok(result.errors.some(e => e.code === 'IMAGE_EMPTY'));
});

test('Validator should warn about missing content type', () => {
  const validator = new DocumentValidator({ strict: false });
  const recognized = {
    metadata: {
      shortName: 'Test',
      consultant: { name: 'John', email: 'john@example.com' },
      organization: 'Test Org',
      createdDate: '23.01.2026'
    },
    history: [{ version: '1.0', date: '23.01.2026', comment: 'Test', author: 'John' }],
    sections: [],
    images: [
      { filename: 'test.png', contentType: null, data: Buffer.from([1, 2, 3]) }
    ]
  };

  const result = validator.validate(recognized);
  assert.ok(result.warnings.some(w => w.code === 'IMAGE_NO_CONTENT_TYPE'));
});
