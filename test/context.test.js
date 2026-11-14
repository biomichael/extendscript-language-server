const test = require('node:test');
const assert = require('node:assert/strict');
const { getCompletionContext, getVariableAliases, resolveAliasChain } = require('../src/context');

test('extracts a member chain', () => {
  const context = getCompletionContext('app.activeDocument.pages[0].pa', { line: 0, character: 30 });
  assert.equal(context.chain, 'app.activeDocument.pages.item');
  assert.equal(context.typed, 'pa');
  assert.equal(context.memberAccess, true);
});

test('extracts an object-literal property context', () => {
  const context = getCompletionContext('app.activeDocument.rectangles.add({geome', { line: 0, character: 40 });
  assert.equal(context.chain, 'app.activeDocument.rectangles.add');
  assert.equal(context.typed, 'geome');
  assert.equal(context.objectLiteral, true);
});

test('extracts a chain after a method call', () => {
  const context = getCompletionContext('app.activeDocument.pages.item(0).pa', { line: 0, character: 36 });
  assert.equal(context.chain, 'app.activeDocument.pages.item');
  assert.equal(context.typed, 'pa');
  assert.equal(context.memberAccess, true);
});

test('extracts a constructor chain', () => {
  const context = getCompletionContext('new File("x").ex', { line: 0, character: 16 });
  assert.equal(context.chain, 'File');
  assert.equal(context.typed, 'ex');
});

test('extracts global identifiers', () => {
  const context = getCompletionContext('app', { line: 0, character: 3 });
  assert.equal(context.chain, null);
  assert.equal(context.typed, 'app');
  assert.equal(context.memberAccess, false);
});

test('tracks a local variable assigned from an API chain', () => {
  const source = 'var tf = app.activeDocument.textFrames.everyItem();\ntf.';
  const position = { line: 1, character: 3 };
  const aliases = getVariableAliases(source, position);
  assert.equal(aliases.tf, 'app.activeDocument.textFrames.everyItem');
  assert.equal(resolveAliasChain('tf', aliases), 'app.activeDocument.textFrames.everyItem');
});
