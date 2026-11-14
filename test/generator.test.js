const test = require('node:test');
const assert = require('node:assert/strict');
const {parseClass, normalizeCatalog} = require('../tools/generate-indesign-catalog');

const textFramesHtml = `
  <h1 class="title"><span class="keyword">TextFrames</span></h1>
  <p class="p description">A collection of text frames.</p>
  <div><h2>Property Listing</h2>
    <table><tr><td><p data-clipboard-text=".length">length</p></td>
      <td><a href="Number.html">Number</a></td><td>readonly</td><td>Count.</td></tr></table>
  </div>
  <div><h2>Method Listing</h2>
    <p class="p methodName"><a href="TextFrame.html">TextFrame</a>
      <strong class="clip_button">itemByName</strong> (name:<em>String</em>)</p>
    <p class="p description">Returns a text frame.</p>
    <p class="p methodName"><a href="TextFrame.html">TextFrame</a>
      <strong class="clip_button">everyItem</strong> ()</p>
  </div>`;

test('parses the uploaded InDesign HTML reference format', () => {
  const parsed = parseClass(textFramesHtml, 'TextFrames.html', false);
  assert.equal(parsed.outputName, 'TextFrameCollection');
  assert.equal(parsed.definition.members.itemByName.type, 'TextFrame');
  assert.equal(parsed.definition.members.everyItem.type, 'TextFrame');
  assert.equal(parsed.definition.members.length.type, 'number');
});

test('generated InDesign catalog contains the completion paths used by the extension', () => {
  const parsed = parseClass(textFramesHtml, 'TextFrames.html', false);
  const catalog = normalizeCatalog([parsed]);
  assert.equal(catalog.types.TextFrameCollection.members.everyItem.type, 'TextFrame');
  assert.ok(catalog.types.TextFrameCollection.members.itemByName);
});
