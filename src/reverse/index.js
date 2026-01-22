/**
 * Reverse Converter - публичный API
 * Конвертация DOCX → Markdown
 */

const { ReverseConverter } = require('./converter');

module.exports = {
  ReverseConverter,

  /**
   * Быстрая конвертация DOCX в Markdown
   * @param {string|Buffer} input - путь к файлу или Buffer
   * @param {Object} options - опции конвертации
   * @returns {Promise<Object>} результат конвертации
   */
  async reverse(input, options = {}) {
    const converter = new ReverseConverter(options);
    return converter.convert(input);
  }
};
