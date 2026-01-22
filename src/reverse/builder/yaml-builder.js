/**
 * YamlBuilder - генерация YAML front matter
 */

class YamlBuilder {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Строит YAML front matter
   * @param {Metadata} metadata - метаданные документа
   * @param {Array<HistoryEntry>} history - история изменений
   * @returns {string} YAML front matter
   */
  build(metadata, history = []) {
    const lines = ['---'];

    // Тип и версия
    lines.push('type: chtz');
    lines.push('version: "1.0"');
    lines.push('');

    // Метаданные
    lines.push('metadata:');
    lines.push(`  shortName: "${this.escape(metadata.shortName || '')}"`);

    // Консультант
    lines.push('  consultant:');
    lines.push(`    name: "${this.escape(metadata.consultant?.name || '')}"`);
    lines.push(`    email: "${this.escape(metadata.consultant?.email || '')}"`);

    // Организация
    lines.push(`  organization: "${this.escape(metadata.organization || '')}"`);

    // ИТ-решения
    if (metadata.itSolutions && metadata.itSolutions.length > 0) {
      lines.push('  itSolutions:');
      for (const solution of metadata.itSolutions) {
        lines.push(`    - "${this.escape(solution)}"`);
      }
    } else {
      lines.push('  itSolutions: []');
    }

    // ИТ-системы
    if (metadata.itSystems && metadata.itSystems.length > 0) {
      lines.push('  itSystems:');
      for (const system of metadata.itSystems) {
        lines.push(`    - "${this.escape(system)}"`);
      }
    } else {
      lines.push('  itSystems: []');
    }

    // Флаги обработки данных
    lines.push(`  processKT: ${metadata.processKT ? 'true' : 'false'}`);
    lines.push(`  processPDn: ${metadata.processPDn ? 'true' : 'false'}`);

    // Дата создания
    lines.push(`  createdDate: "${this.escape(metadata.createdDate || '')}"`);

    // История изменений
    lines.push('');
    lines.push('history:');

    if (history && history.length > 0) {
      for (const entry of history) {
        lines.push(`  - version: "${this.escape(entry.version || '1.0')}"`);
        lines.push(`    date: "${this.escape(entry.date || '')}"`);
        lines.push(`    comment: "${this.escape(entry.comment || '')}"`);
        lines.push(`    author: "${this.escape(entry.author || '')}"`);
      }
    } else {
      lines.push('  - version: "1.0"');
      lines.push(`    date: "${this.formatDate(new Date())}"`);
      lines.push('    comment: "Конвертировано из DOCX"');
      lines.push('    author: ""');
    }

    lines.push('---');

    return lines.join('\n');
  }

  /**
   * Экранирует строку для YAML
   */
  escape(str) {
    if (!str) return '';

    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  }

  /**
   * Форматирует дату в DD.MM.YYYY
   */
  formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }
}

module.exports = { YamlBuilder };
