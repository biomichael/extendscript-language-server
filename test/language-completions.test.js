const test = require('node:test');
const assert = require('node:assert/strict');
const {getLanguageCompletions} = require('../src/language-completions');

test('provides language keyword completions', () => {
  const completions = getLanguageCompletions();
  assert.equal(completions.function.kind, 'keyword');
  assert.equal(completions.function.snippet, true);
  assert.match(completions.function.insertText, /^function /);
  assert.equal(completions.var.kind, 'keyword');
  assert.equal(completions.for.kind, 'keyword');
  assert.equal(completions.return.kind, 'keyword');
});
