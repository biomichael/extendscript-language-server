const IDENTIFIER = '[A-Za-z_$][A-Za-z0-9_$]*';

function parametersFromFunction(source, start) {
  const match = String(source).slice(start).match(/function(?:\s+[$A-Za-z_][$\w]*)?\s*\(([^)]*)\)/);
  if (!match) return '';
  return match[1]
    .split(',')
    .map((parameter) => parameter.trim())
    .filter(Boolean)
    .join(', ');
}

function functionDefinition(parameters, detail = 'Local function') {
  return {
    kind: 'function',
    type: 'Function',
    parameters,
    detail
  };
}

function variableDefinition(initializer) {
  const expression = String(initializer || '').trim();
  if (/^(?:new\s+)?[A-Za-z_$][A-Za-z0-9_$]*(?:\s*\([^;]*\))?$/.test(expression)) {
    return {kind: 'variable', type: 'Object', detail: 'Local variable'};
  }
  return {kind: 'variable', detail: 'Local variable'};
}

function getLocalSymbols(source) {
  const text = String(source || '');
  const globals = {};
  const prototypeMembers = {};

  let match;
  const functionPattern = new RegExp(`\\bfunction\\s+(${IDENTIFIER})\\s*\\(`, 'g');
  while ((match = functionPattern.exec(text))) {
    globals[match[1]] = functionDefinition(parametersFromFunction(text, match.index));
  }

  const assignedFunctionPattern = new RegExp(
    `\\b(?:var|let|const)\\s+(${IDENTIFIER})\\s*=\\s*function\\b`,
    'g'
  );
  while ((match = assignedFunctionPattern.exec(text))) {
    globals[match[1]] = functionDefinition(parametersFromFunction(text, match.index));
  }

  const variablePattern = new RegExp(
    `\\b(?:var|let|const)\\s+(${IDENTIFIER})(?:\\s*=\\s*([^;\\n]+))?`,
    'g'
  );
  while ((match = variablePattern.exec(text))) {
    if (!globals[match[1]]) globals[match[1]] = variableDefinition(match[2]);
  }

  const prototypePattern = new RegExp(
    `\\b(${IDENTIFIER})\\.prototype\\.(${IDENTIFIER})\\s*=\\s*([^;\\n]+)`,
    'g'
  );
  while ((match = prototypePattern.exec(text))) {
    const owner = match[1];
    const member = match[2];
    const assignment = match[3];
    const members = prototypeMembers[owner] || (prototypeMembers[owner] = {});
    const functionOffset = match.index + match[0].indexOf('=') + 1;
    if (/^\s*function\b/.test(assignment)) {
      members[member] = functionDefinition(
        parametersFromFunction(text, functionOffset),
        `${owner}.prototype method`
      );
    } else {
      members[member] = {kind: 'property', detail: `${owner}.prototype property`};
    }
  }

  return {globals, prototypeMembers};
}

function getLocalMembers(symbols, chain, typeName) {
  const normalized = String(chain || '').replace(/\s+/g, '');
  const prototypeMatch = normalized && normalized.match(new RegExp(`^(${IDENTIFIER})(?:\\.prototype)?$`));
  const owner = typeName || (prototypeMatch && prototypeMatch[1]);
  if (!owner) return {};
  return (symbols && symbols.prototypeMembers && symbols.prototypeMembers[owner]) || {};
}

module.exports = {
  getLocalSymbols,
  getLocalMembers
};
