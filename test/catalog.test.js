const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadCatalog, getDefinition, getMembers } = require('../src/catalog');

const root = path.resolve(__dirname, '..');

test('loads the InDesign profile', () => {
  const catalog = loadCatalog(root, 'indesign');
  assert.equal(getDefinition(catalog, 'app.activeDocument.pages').type, 'PageCollection');
  assert.equal(getDefinition(catalog, 'app.activeDocument.pages.item').type, 'Page');
  assert.ok(getMembers(catalog, 'app.activeDocument').textFrames);
  assert.equal(getDefinition(catalog, 'app.activeDocument.characterStyles').type, 'CharacterStyleCollection');
  assert.equal(getDefinition(catalog, 'app.activeDocument.characterStyles.everyItem').type, 'CharacterStyle');
  assert.equal(getDefinition(catalog, 'app.activeDocument.characterStyles.itemByName').type, 'CharacterStyle');
  assert.equal(getDefinition(catalog, 'app.activeDocument.characterStyles.itemByName.duplicate').type, 'CharacterStyle');
  assert.ok(getMembers(catalog, 'app.activeDocument.characterStyles').everyItem);
  assert.ok(getMembers(catalog, 'app.activeDocument.characterStyles.itemByName').duplicate);
  assert.equal(getDefinition(catalog, 'app.activeDocument.rectangles').type, 'RectangleCollection');
  assert.equal(getDefinition(catalog, 'app.activeDocument.rectangles.everyItem').type, 'PageItem');
  assert.equal(getDefinition(catalog, 'app.activeDocument.rectangles.itemByName').type, 'PageItem');
  assert.equal(getDefinition(catalog, 'app.activeDocument.rectangles.add').propertiesType, 'PageItem');
  assert.equal(getDefinition(catalog, 'app.activeDocument.rectangles.item.geometricBounds').type, 'Array');
  assert.equal(getDefinition(catalog, 'app.activeDocument.textFrames.everyItem').type, 'TextFrame');
  assert.equal(getDefinition(catalog, 'app.activeDocument.textFrames.itemByName').type, 'TextFrame');
  assert.equal(getDefinition(catalog, 'app.activeDocument.textFrames.itemByRange').type, 'Array');
  assert.equal(getDefinition(catalog, 'app.activeDocument.textFrames.itemByID').type, 'TextFrame');
  assert.equal(getDefinition(catalog, 'app.activeDocument.textFrames.firstItem').type, 'TextFrame');
  assert.equal(getDefinition(catalog, 'app.activeDocument.textFrames.lastItem').type, 'TextFrame');
  assert.equal(getDefinition(catalog, 'app.activeDocument.textFrames.middleItem').type, 'TextFrame');
  assert.ok(getMembers(catalog, 'app.activeDocument.textFrames').itemByName);
  assert.ok(getMembers(catalog, 'app.activeDocument.textFrames').itemByRange);
});

test('keeps common ExtendScript globals available', () => {
  const catalog = loadCatalog(root, 'indesign');
  assert.equal(getDefinition(catalog, 'File').type, 'File');
  assert.equal(getDefinition(catalog, '$').type, 'Dollar');
  assert.equal(getDefinition(catalog, 'alert').type, 'void');
});

test('loads Photoshop APIs observed in the supplied scripts', () => {
  const catalog = loadCatalog(root, 'photoshop');
  assert.equal(getDefinition(catalog, 'app.activeDocument').type, 'PhotoshopDocument');
  assert.equal(getDefinition(catalog, 'app.activeDocument.activeLayer').type, 'PhotoshopLayer');
  assert.equal(getDefinition(catalog, 'LayerKind.SMARTOBJECT').type, 'LayerKind');
  assert.equal(getDefinition(catalog, 'ActionDescriptor').type, 'ActionDescriptor');
});
