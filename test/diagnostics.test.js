const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadCatalog, getDefinition } = require('../src/catalog');
const { getVariableAliases, resolveAliasChain } = require('../src/context');
const {
  findApiDiagnostics,
  findParserDiagnostics,
  findStructuralDiagnostics,
  suggestMemberNames
} = require('../src/diagnostics');

const root = path.resolve(__dirname, '..');

function diagnose(source) {
  return findApiDiagnostics(
    source,
    loadCatalog(root, 'indesign'),
    getVariableAliases,
    resolveAliasChain,
    getDefinition
  );
}

test('reports an unknown member on a known InDesign type', () => {
  const diagnostics = diagnose('app.activeDocument.textFrames.everItem();');
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].message, "Unknown ExtendScript member 'everItem' on type 'TextFrameCollection'.");
  assert.deepEqual(diagnostics[0].range.start, { line: 0, character: 30 });
});

test('does not report known members', () => {
  assert.deepEqual(diagnose('app.activeDocument.textFrames.everyItem();'), []);
});

test('reports unknown members through an inferred local variable', () => {
  const source = 'var tf = app.activeDocument.textFrames.everyItem();\ntf.everItem();';
  const diagnostics = diagnose(source);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].range.start.line, 1);
  assert.equal(diagnostics[0].range.start.character, 3);
});

test('ignores strings and comments', () => {
  const source = '// app.activeDocument.textFrames.everItem();\nvar value = "app.activeDocument.textFrames.everItem()";';
  assert.deepEqual(diagnose(source), []);
});

test('suggests a nearby valid member for a typo', () => {
  const catalog = loadCatalog(root, 'indesign');
  assert.deepEqual(
    suggestMemberNames(catalog, 'Application', 'actoveDocument'),
    ['activeDocument']
  );
});

test('reports unclosed delimiters', () => {
  const diagnostics = findStructuralDiagnostics('if (true) {\n  var value = [1, 2;');
  assert.equal(diagnostics.length, 2);
  assert.match(diagnostics[0].message, /Unclosed '\['/);
  assert.match(diagnostics[1].message, /Unclosed '\{'/);
});

test('reports mismatched and unexpected delimiters', () => {
  const diagnostics = findStructuralDiagnostics('var value = (1, 2]; }');
  assert.equal(diagnostics.length, 2);
  assert.match(diagnostics[0].message, /Mismatched closing '\]'/);
  assert.match(diagnostics[1].message, /Unexpected closing '\}'/);
});

test('reports unterminated strings and comments', () => {
  assert.match(findStructuralDiagnostics('var value = "unfinished;')[0].message, /Unterminated string/);
  assert.match(findStructuralDiagnostics('/* unfinished')[0].message, /Unterminated block comment/);
});

test('ignores delimiters inside comments, strings, and regex literals', () => {
  const source = 'var text = "{[()]"; var pattern = /[{}()]/g; /* ([ */';
  assert.deepEqual(findStructuralDiagnostics(source), []);
});

test('reports ordinary JavaScript syntax errors', () => {
  const diagnostics = findParserDiagnostics('var value = ;');
  assert.equal(diagnostics.length, 1);
  assert.match(diagnostics[0].message, /Syntax error/);
});

test('accepts ExtendScript directives and common E4X literals', () => {
  const source = '#target "InDesign"\nvar xml = <root><item /></root>;\nvar value = 1;';
  assert.deepEqual(findParserDiagnostics(source), []);
});

test('accepts ExtendScript for-each syntax', () => {
  assert.deepEqual(findParserDiagnostics('for each (var item in items) { $.writeln(item); }'), []);
});
