const fs = require('fs');
const path = require('path');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeObjects(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
        target[key] = {};
      }
      mergeObjects(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function enrichCollectionMembers(catalog) {
  for (const [typeName, typeDefinition] of Object.entries(catalog.types || {})) {
    if (!typeName.endsWith('Collection') || !typeDefinition.members) continue;
    const item = typeDefinition.members.item;
    if (!item || !item.type) continue;

    const defaults = {
      anyItem: {kind: 'method', type: item.type, parameters: ''},
      firstItem: {kind: 'method', type: item.type, parameters: ''},
      itemByID: {kind: 'method', type: item.type, parameters: 'id'},
      itemByName: {kind: 'method', type: item.type, parameters: 'name'},
      itemByRange: {kind: 'method', type: 'Array', parameters: 'from, to'},
      lastItem: {kind: 'method', type: item.type, parameters: ''},
      middleItem: {kind: 'method', type: item.type, parameters: ''},
      nextItem: {kind: 'method', type: item.type, parameters: 'obj'},
      previousItem: {kind: 'method', type: item.type, parameters: 'obj'}
    };

    for (const [memberName, definition] of Object.entries(defaults)) {
      if (!typeDefinition.members[memberName]) {
        typeDefinition.members[memberName] = definition;
      }
    }
  }
  return catalog;
}

function loadCatalog(extensionRoot, host, customPaths = []) {
  const dataRoot = path.join(extensionRoot, 'data');
  const common = readJson(path.join(dataRoot, 'common.json'));
  const generatedFile = path.join(dataRoot, `${host}.generated.json`);
  const hostFile = path.join(dataRoot, `${host}.json`);
  const catalog = mergeObjects(
    mergeObjects(clone(common), fs.existsSync(generatedFile) ? readJson(generatedFile) : {}),
    fs.existsSync(hostFile) ? readJson(hostFile) : {}
  );

  for (const customPath of customPaths) {
    const resolved = path.isAbsolute(customPath)
      ? customPath
      : path.resolve(customPath);
    if (fs.existsSync(resolved)) {
      mergeObjects(catalog, readJson(resolved));
    }
  }

  enrichCollectionMembers(catalog);
  catalog.host = host;
  return catalog;
}

function getDefinition(catalog, chain) {
  const parts = String(chain || '').split('.').filter(Boolean);
  if (!parts.length) return null;

  let definition = catalog.globals && catalog.globals[parts[0]];
  if (!definition) return null;

  for (const part of parts.slice(1)) {
    const typeName = definition.type;
    const typeDefinition = catalog.types && catalog.types[typeName];
    const members = typeDefinition && typeDefinition.members;
    if (!members || !members[part]) return null;
    definition = members[part];
  }

  return definition;
}

function getMembers(catalog, chain) {
  if (!chain) return catalog.globals || {};
  const definition = getDefinition(catalog, chain);
  if (!definition || !definition.type) return {};
  const typeDefinition = catalog.types && catalog.types[definition.type];
  return (typeDefinition && typeDefinition.members) || {};
}

module.exports = {
  loadCatalog,
  getDefinition,
  getMembers,
  enrichCollectionMembers,
  mergeObjects
};
