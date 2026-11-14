const test = require('node:test');
const assert = require('node:assert/strict');
const {getLocalSymbols, getLocalMembers} = require('../src/local-symbols');

test('indexes local functions and variables', () => {
  const symbols = getLocalSymbols(`
    function makeFrame(name) { return name; }
    var configured = {};
    const helper = function(value) { return value; };
  `);

  assert.equal(symbols.globals.makeFrame.kind, 'function');
  assert.equal(symbols.globals.makeFrame.parameters, 'name');
  assert.equal(symbols.globals.configured.kind, 'variable');
  assert.equal(symbols.globals.helper.kind, 'function');
  assert.equal(symbols.globals.helper.parameters, 'value');
});

test('indexes prototype methods and properties', () => {
  const symbols = getLocalSymbols(`
    function Widget() {}
    Widget.prototype.render = function(options) {};
    Widget.prototype.enabled = true;
    PageItem.prototype.highlight = function(color) {};
  `);
  const members = getLocalMembers(symbols, 'Widget.prototype');

  assert.equal(members.render.kind, 'function');
  assert.equal(members.render.parameters, 'options');
  assert.equal(members.enabled.kind, 'property');
  assert.equal(getLocalMembers(symbols, 'Widget').render.kind, 'function');
  assert.equal(getLocalMembers(symbols, 'somePageItem', 'PageItem').highlight.kind, 'function');
});
