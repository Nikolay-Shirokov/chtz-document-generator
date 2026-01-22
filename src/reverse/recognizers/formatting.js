/**
 * FormattingRecognizer - распознавание форматирования текста
 */

class FormattingRecognizer {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Преобразует runs в форматированный текст Markdown
   * @param {Array<Run>} runs - массив runs
   * @returns {string} форматированный текст
   */
  formatRuns(runs) {
    if (!runs || runs.length === 0) {
      return '';
    }

    const parts = [];

    for (const run of runs) {
      let text = run.text;
      if (!text) continue;

      // Применяем форматирование
      if (run.bold && run.italic) {
        text = `***${text}***`;
      } else if (run.bold) {
        text = `**${text}**`;
      } else if (run.italic) {
        text = `*${text}*`;
      }

      parts.push(text);
    }

    // Объединяем и очищаем двойное форматирование
    let result = parts.join('');

    // Убираем пустые форматирования
    result = result.replace(/\*\*\*\*\*\*/g, '');
    result = result.replace(/\*\*\*\*/g, '');
    result = result.replace(/\*\*/g, function(match, offset, string) {
      // Сохраняем ** только если это не пустое форматирование
      const before = string.substring(0, offset);
      const after = string.substring(offset + 2);
      if (before.endsWith('**') || after.startsWith('**')) {
        return '';
      }
      return match;
    });

    // Объединяем соседние форматирования
    result = this.mergeAdjacentFormatting(result);

    return result;
  }

  /**
   * Объединяет соседние одинаковые форматирования
   */
  mergeAdjacentFormatting(text) {
    // **text1****text2** -> **text1text2**
    text = text.replace(/\*\*([^*]+)\*\*\*\*([^*]+)\*\*/g, '**$1$2**');

    // *text1**text2* -> *text1text2*
    text = text.replace(/\*([^*]+)\*\*([^*]+)\*/g, '*$1$2*');

    return text;
  }

  /**
   * Распознаёт блоки в тексте (предусловия, сценарии и т.д.)
   */
  recognizeBlocks(text) {
    const blocks = [];
    const lines = text.split('\n');

    let currentBlock = null;
    let currentContent = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Проверяем заголовки блоков
      const blockHeader = this.identifyBlockHeader(trimmed);

      if (blockHeader) {
        // Сохраняем предыдущий блок
        if (currentBlock) {
          blocks.push({
            type: currentBlock,
            content: currentContent.join('\n')
          });
        }

        currentBlock = blockHeader;
        currentContent = [];
      } else if (currentBlock) {
        currentContent.push(line);
      } else {
        // Контент до первого блока
        if (trimmed) {
          blocks.push({
            type: 'text',
            content: trimmed
          });
        }
      }
    }

    // Добавляем последний блок
    if (currentBlock) {
      blocks.push({
        type: currentBlock,
        content: currentContent.join('\n')
      });
    }

    return blocks;
  }

  /**
   * Идентифицирует заголовок блока
   */
  identifyBlockHeader(text) {
    const headers = {
      'предусловия': 'preconditions',
      'основной сценарий': 'main-scenario',
      'альтернативный сценарий': 'alt-scenario',
      'ограничения': 'constraints',
      'примечание': 'note',
      'важно': 'important'
    };

    const normalized = text.toLowerCase().replace(/[*:]/g, '').trim();

    for (const [pattern, type] of Object.entries(headers)) {
      if (normalized.includes(pattern)) {
        return type;
      }
    }

    return null;
  }

  /**
   * Преобразует список элементов в Markdown
   */
  formatList(items, ordered = false) {
    const lines = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const prefix = ordered ? `${i + 1}. ` : '- ';
      const indent = '  '.repeat(item.level || 0);
      lines.push(`${indent}${prefix}${item.text}`);
    }

    return lines.join('\n');
  }

  /**
   * Определяет, является ли текст нумерованным пунктом
   */
  isNumberedItem(text) {
    return /^\d+\.\s/.test(text.trim());
  }

  /**
   * Определяет, является ли текст маркированным пунктом
   */
  isBulletItem(text) {
    return /^[•●\-–—]\s/.test(text.trim());
  }

  /**
   * Извлекает номер из нумерованного пункта
   */
  extractNumber(text) {
    const match = text.match(/^(\d+)\.\s/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Очищает маркер списка
   */
  stripListMarker(text) {
    return text.replace(/^(\d+\.\s|[•●\-–—]\s)/, '').trim();
  }
}

module.exports = { FormattingRecognizer };
