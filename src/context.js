const IDENTIFIER = '[A-Za-z_$][A-Za-z0-9_$]*';

function linePrefix(text, position) {
  const lines = String(text).split(/\r?\n/);
  const line = lines[position.line] || '';
  return line.slice(0, Math.min(position.character, line.length));
}

function textBeforePosition(text, position) {
  const lines = String(text).split(/\r?\n/);
  return lines.slice(0, position.line).concat(
    (lines[position.line] || '').slice(0, position.character)
  ).join('\n');
}

function normalizeChain(chain) {
  return String(chain)
    .replace(/\s+/g, '')
    .replace(/\[\s*\d+\s*\]/g, '.item')
    .replace(/^new/, '')
    .replace(/\([^()]*\)/g, '');
}

function getCompletionContext(text, position) {
  const prefix = linePrefix(text, position);

  // Handles object-literal arguments such as
  // `app.activeDocument.rectangles.add({geome})`.
  const objectLiteral = prefix.match(
    new RegExp(`((?:${IDENTIFIER})(?:(?:\\s*\\.\\s*${IDENTIFIER})|(?:\\s*\\[\\s*\\d+\\s*\\]))*)\\s*\\.\\s*(${IDENTIFIER})\\s*\\(\\s*\\{[^{}]*?(${IDENTIFIER})?$`)
  );
  if (objectLiteral) {
    return {
      prefix,
      chain: `${normalizeChain(objectLiteral[1])}.${objectLiteral[2]}`,
      typed: objectLiteral[3] || '',
      memberAccess: false,
      objectLiteral: true
    };
  }

  // Handles constructors such as `new File().` without requiring a full parser.
  const constructor = prefix.match(
    new RegExp(`(new\\s+${IDENTIFIER}(?:\\s*\\([^()]*\\))?)\\s*\\.\\s*(${IDENTIFIER})?$`)
  );
  if (constructor) {
    return {
      prefix,
      chain: normalizeChain(constructor[1]),
      typed: constructor[2] || '',
      memberAccess: true
    };
  }

  // Handles chains such as `app.activeDocument.pages[0].pa`.
  const chainSegment = `(?:${IDENTIFIER})(?:\\s*\\([^()]*\\))?`;
  const member = prefix.match(
    new RegExp(`((?:${chainSegment})(?:(?:\\s*\\.\\s*${chainSegment})|(?:\\s*\\[\\s*\\d+\\s*\\]))*)\\s*\\.\\s*(${IDENTIFIER})?$`)
  );
  if (member) {
    return {
      prefix,
      chain: normalizeChain(member[1]),
      typed: member[2] || '',
      memberAccess: true
    };
  }

  const global = prefix.match(new RegExp(`(${IDENTIFIER})$`));
  return {
    prefix,
    chain: null,
    typed: global ? global[1] : '',
    memberAccess: false
  };
}

function getChainParts(chain) {
  if (!chain) return [];
  return normalizeChain(chain).match(new RegExp(IDENTIFIER, 'g')) || [];
}

function isChainExpression(expression) {
  const compact = String(expression).trim();
  const segment = `${IDENTIFIER}(?:\\s*\\([^()]*\\))?`;
  return new RegExp(`^(?:new\\s+)?${segment}(?:(?:\\s*\\.\\s*${segment})|(?:\\s*\\[\\s*\\d+\\s*\\]))*$`).test(compact);
}

function getVariableAliases(text, position) {
  const prefix = textBeforePosition(text, position);
  const aliases = {};
  const assignment = new RegExp(`(?:\\b(?:var|let|const)\\s+)?(${IDENTIFIER})\\s*=\\s*([^;\\n]+)`, 'g');
  let match;

  while ((match = assignment.exec(prefix))) {
    const name = match[1];
    const expression = match[2].trim();
    if (isChainExpression(expression)) {
      aliases[name] = normalizeChain(expression);
    }
  }

  return aliases;
}

function resolveAliasChain(chain, aliases) {
  const normalized = normalizeChain(chain);
  if (!normalized) return normalized;

  const names = Object.keys(aliases || {}).sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (normalized === name) return aliases[name];
    if (normalized.startsWith(`${name}.`)) {
      return `${aliases[name]}${normalized.slice(name.length)}`;
    }
  }
  return normalized;
}

module.exports = {
  getCompletionContext,
  getChainParts,
  normalizeChain,
  getVariableAliases,
  resolveAliasChain
};
