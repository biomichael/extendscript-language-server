#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const primitiveTypes = new Map([
  ['bool', 'boolean'],
  ['boolean', 'boolean'],
  ['double', 'number'],
  ['integer', 'number'],
  ['long integer', 'number'],
  ['longinteger', 'number'],
  ['number', 'number'],
  ['real', 'number'],
  ['string', 'string'],
  ['void', 'void']
]);

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function firstMatch(value, pattern) {
  const match = String(value).match(pattern);
  return match && match[1] ? stripHtml(match[1]) : '';
}

function sectionBetween(html, startPattern, endPattern) {
  const start = String(html).search(startPattern);
  if (start < 0) return '';
  const afterStart = html.slice(start);
  const end = afterStart.search(endPattern);
  return end < 0 ? afterStart : afterStart.slice(0, end);
}

function typeFromHtml(value) {
  const linked = String(value).match(/<a[^>]+href="[^"#?]+\.html(?:#[^"]*)?"[^>]*>([\s\S]*?)<\/a>/i);
  const raw = linked ? stripHtml(linked[1]) : stripHtml(value).split(/\s+of\s+/i)[0];
  const normalized = primitiveTypes.get(String(raw).trim().toLowerCase());
  return normalized || String(raw).trim() || 'Object';
}

function parseParameters(signature) {
  const names = [];
  const add = (name) => {
    const clean = stripHtml(name);
    if (clean && !names.includes(clean)) names.push(clean);
  };

  let match;
  const legacyPattern = /<span class="arg">([^<]+)<\/span>/gi;
  while ((match = legacyPattern.exec(signature))) add(match[1]);

  const modernPattern = /(?:\[\s*)?([A-Za-z_$][\w$]*)\s*:\s*(?:<[^>]+>)*<em\b/gi;
  while ((match = modernPattern.exec(signature))) add(match[1]);
  return names;
}

function parseMethod(block) {
  const name = firstMatch(block, /<span class="func">([\s\S]*?)<\/span>/i)
    || firstMatch(block, /<strong[^>]*class="[^"]*clip_button[^"]*"[^>]*>([\s\S]*?)<\/strong>/i);
  if (!name || name === '[]') return null;

  const functionIndex = block.search(/<span class="func">|<strong[^>]*class="[^"]*clip_button[^"]*"/i);
  const returnHtml = functionIndex >= 0 ? block.slice(0, functionIndex) : '';
  const arrayElement = returnHtml.match(/Array<\/a>\s+of\s+(?:<a[^>]+>)?([^<\s]+)(?:<\/a>)?/i);
  const returnType = arrayElement ? 'Array' : typeFromHtml(returnHtml);
  const returnElementType = arrayElement ? stripHtml(arrayElement[1]) : '';
  const signature = block.slice(functionIndex >= 0 ? functionIndex : 0);
  const description = firstMatch(block, /<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  const definition = {
    kind: 'method',
    type: returnType,
    parameters: parseParameters(signature).join(', ')
  };

  if (returnElementType) definition.elementType = returnElementType;
  if (name === 'everyItem' && returnType !== 'Array' && returnType !== 'Object') {
    definition.elementType = returnType;
  }
  if (description) definition.documentation = description;
  if (name === 'add' && definition.parameters.split(/,\s*/).includes('withProperties')) {
    definition.propertiesType = returnElementType || returnType;
  }
  return [name, definition];
}

function parseProperties(section) {
  const members = {};
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowPattern.exec(section))) {
    const row = match[1];
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]);
    if (cells.length < 2) continue;
    const nameMatch = row.match(/data-clipboard-text="\.([^".]*)"/i)
      || row.match(/<a\s+name="([^"]+)"/i);
    const name = nameMatch ? stripHtml(nameMatch[1]) : '';
    if (!name) continue;
    const definition = {type: typeFromHtml(cells[1])};
    const access = cells.length >= 4 ? stripHtml(cells[2]) : '';
    const documentation = cells.length >= 4 ? stripHtml(cells[3]) : stripHtml(cells[2]);
    if (access) definition.detail = access;
    if (documentation) definition.documentation = documentation;
    members[name] = definition;
  }
  return members;
}

function parseMethods(section) {
  const members = {};
  const headerPattern = /<p\b[^>]*class="[^"]*(?:spaceBelow|methodName)[^"]*"[^>]*>[\s\S]*?<\/p>/gi;
  const headers = [...section.matchAll(headerPattern)];
  for (let index = 0; index < headers.length; index += 1) {
    const start = headers[index].index;
    const end = index + 1 < headers.length ? headers[index + 1].index : section.length;
    const method = parseMethod(section.slice(start, end));
    if (method) members[method[0]] = method[1];
  }
  return members;
}

function parseEnum(html, name) {
  const members = {};
  const valueSection = sectionBetween(html, />Values?<\/h[23]>/i, /<\/body>/i);
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowPattern.exec(valueSection))) {
    const row = match[1];
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]);
    if (cells.length < 2) continue;
    const fullName = stripHtml(cells[0]);
    const prefix = `${name}.`;
    if (!fullName.startsWith(prefix)) continue;
    members[fullName.slice(prefix.length)] = {
      kind: 'constant',
      type: name,
      documentation: stripHtml(cells[1])
    };
  }
  return {kind: 'enum', members};
}

function parseClass(html, fileName, isEnum) {
  const name = firstMatch(html, /<h1\b[^>]*>[\s\S]*?<span\b[^>]*class="[^"]*keyword[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/h1>/i)
    || firstMatch(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
    || firstMatch(html, /<title>([\s\S]*?)<\/title>/i);
  if (!name) return null;

  const hasValues = /<h[23]\b[^>]*>\s*Values?\s*<\/h[23]>/i.test(html);
  const hasMethods = /<h[23]\b[^>]*>\s*Method Listing\s*<\/h[23]>/i.test(html);
  if (isEnum || (hasValues && !hasMethods)) {
    return {rawName: name, outputName: name, kind: 'enum', definition: parseEnum(html, name)};
  }

  const properties = sectionBetween(html, /<h[23]\b[^>]*>\s*(?:Property Listing|Properties)\s*<\/h[23]>/i, /<h[23]\b[^>]*>\s*(?:Method Listing|Methods)\s*<\/h[23]>/i);
  const methods = sectionBetween(html, /<h[23]\b[^>]*>\s*(?:Method Listing|Methods)\s*<\/h[23]>/i, /<\/body>/i);
  const baseClass = firstMatch(html, /Base Class:\s*<a[^>]+>([^<]+)<\/a>/i);
  const members = {...parseProperties(properties), ...parseMethods(methods)};
  const itemType = (members.item && members.item.type)
    || (members.everyItem && (members.everyItem.elementType || members.everyItem.type));
  const collection = Boolean(itemType && itemType !== 'Object' && itemType !== 'Array');
  const outputName = collection ? `${itemType}Collection` : name;
  const description = firstMatch(html, /<p\b[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/p>/i);

  return {
    rawName: name,
    outputName,
    kind: 'class',
    baseClass,
    collection,
    definition: {
      kind: 'class',
      detail: `InDesign ${name}`,
      ...(description ? {documentation: description} : {}),
      members
    },
    fileName
  };
}

function buildTypeMap(parsed) {
  const map = new Map();
  for (const item of parsed) map.set(item.rawName, item.outputName);
  return map;
}

function normalizeType(type, typeMap) {
  const normalized = primitiveTypes.get(String(type || '').trim().toLowerCase());
  return normalized || typeMap.get(type) || type || 'Object';
}

function normalizeDefinition(definition, typeMap) {
  if (definition.type) definition.type = normalizeType(definition.type, typeMap);
  if (definition.elementType) definition.elementType = normalizeType(definition.elementType, typeMap);
  if (definition.propertiesType) definition.propertiesType = normalizeType(definition.propertiesType, typeMap);
  if (definition.type === 'Array' && definition.elementType) definition.type = definition.elementType;
  return definition;
}

function normalizeCatalog(parsed) {
  const typeMap = buildTypeMap(parsed);
  const catalog = {globals: {}, types: {}};

  for (const item of parsed) {
    if (item.kind === 'enum') {
      catalog.types[item.outputName] = item.definition;
      catalog.globals[item.outputName] = {
        kind: 'class',
        type: item.outputName,
        detail: `InDesign ${item.outputName} enumeration`
      };
      continue;
    }

    const definition = item.definition;
    if (item.baseClass) definition.base = normalizeType(item.baseClass, typeMap);
    for (const member of Object.values(definition.members || {})) normalizeDefinition(member, typeMap);
    catalog.types[item.outputName] = definition;
  }

  function inheritedMembers(typeName, seen = new Set()) {
    if (seen.has(typeName)) return {};
    seen.add(typeName);
    const definition = catalog.types[typeName];
    if (!definition) return {};
    const baseMembers = definition.base ? inheritedMembers(definition.base, seen) : {};
    return {...baseMembers, ...(definition.members || {})};
  }

  for (const [typeName, definition] of Object.entries(catalog.types)) {
    if (definition.members) definition.members = inheritedMembers(typeName);
  }
  return catalog;
}

function generate(inputRoot, outputPath) {
  const files = fs.readdirSync(inputRoot)
    .filter((fileName) => /\.html?$/i.test(fileName))
    .sort();
  const parsed = [];

  for (const fileName of files) {
    const html = fs.readFileSync(path.join(inputRoot, fileName), 'utf8');
    const item = parseClass(html, fileName, /^pe_/i.test(fileName));
    if (item) parsed.push(item);
  }

  const catalog = normalizeCatalog(parsed);
  catalog.meta = {
    source: 'Adobe InDesign HTML Object Reference',
    generatedAt: new Date().toISOString(),
    classes: parsed.filter((item) => item.kind === 'class').length,
    enums: parsed.filter((item) => item.kind === 'enum').length,
    files: files.length
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`Generated ${catalog.meta.classes} classes and ${catalog.meta.enums} enums at ${outputPath}`);
}

if (require.main === module) {
  const inputRoot = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputRoot || !outputPath) {
    console.error('Usage: node tools/generate-indesign-catalog.js <html-root> <output-json>');
    process.exit(1);
  }
  generate(path.resolve(inputRoot), path.resolve(outputPath));
}

module.exports = {
  generate,
  normalizeCatalog,
  parseClass,
  parseMethods,
  parseProperties
};
