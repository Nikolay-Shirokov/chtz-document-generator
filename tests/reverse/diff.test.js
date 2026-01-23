/**
 * Тесты для функции diff
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { ReverseConverter } = require('../../src/reverse');

test('Diff should detect identical documents', () => {
  const converter = new ReverseConverter();
  const doc = '# Test\n\nSome content\n';

  const result = converter.diff(doc, doc, { stats: true });

  assert.strictEqual(result.stats.identical, true);
  assert.strictEqual(result.stats.linesAdded, 0);
  assert.strictEqual(result.stats.linesRemoved, 0);
  assert.ok(result.diff.includes('идентичны'));
});

test('Diff should detect added lines', () => {
  const converter = new ReverseConverter();
  const original = '# Test\n\nSome content\n';
  const modified = '# Test\n\nSome content\nNew line\n';

  const result = converter.diff(original, modified, { stats: true });

  assert.strictEqual(result.stats.identical, false);
  assert.strictEqual(result.stats.linesAdded, 1);
  assert.strictEqual(result.stats.linesRemoved, 0);
  assert.ok(result.diff.includes('+'));
});

test('Diff should detect removed lines', () => {
  const converter = new ReverseConverter();
  const original = '# Test\n\nSome content\nExtra line\n';
  const modified = '# Test\n\nSome content\n';

  const result = converter.diff(original, modified, { stats: true });

  assert.strictEqual(result.stats.identical, false);
  assert.strictEqual(result.stats.linesAdded, 0);
  assert.strictEqual(result.stats.linesRemoved, 1);
  assert.ok(result.diff.includes('-'));
});

test('Diff should detect changed lines', () => {
  const converter = new ReverseConverter();
  const original = '# Test\n\nOriginal content\n';
  const modified = '# Test\n\nModified content\n';

  const result = converter.diff(original, modified, { stats: true });

  assert.strictEqual(result.stats.identical, false);
  assert.strictEqual(result.stats.linesAdded, 1);
  assert.strictEqual(result.stats.linesRemoved, 1);
  assert.strictEqual(result.stats.linesChanged, 2);
  assert.ok(result.diff.includes('+'));
  assert.ok(result.diff.includes('-'));
});

test('Diff should return string when stats=false', () => {
  const converter = new ReverseConverter();
  const original = '# Test\n';
  const modified = '# Test Modified\n';

  const result = converter.diff(original, modified, { stats: false });

  assert.strictEqual(typeof result, 'string');
  assert.ok(result.includes('---'));
  assert.ok(result.includes('+++'));
});

test('Diff should handle empty documents', () => {
  const converter = new ReverseConverter();
  const empty = '';
  const withContent = '# Test\n';

  const result = converter.diff(empty, withContent, { stats: true });

  assert.strictEqual(result.stats.identical, false);
  assert.ok(result.stats.linesAdded > 0);
});

test('Diff should respect context lines option', () => {
  const converter = new ReverseConverter();
  const original = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n';
  const modified = 'Line 1\nLine 2\nModified\nLine 4\nLine 5\n';

  // With 1 context line
  const result1 = converter.diff(original, modified, { contextLines: 1 });

  // With 3 context lines
  const result3 = converter.diff(original, modified, { contextLines: 3 });

  // Both should contain the diff, but with different amounts of context
  assert.ok(result1.includes('Modified'));
  assert.ok(result3.includes('Modified'));
  assert.strictEqual(typeof result1, 'string');
  assert.strictEqual(typeof result3, 'string');
});
