const IDENTIFIER = '[A-Za-z_$][A-Za-z0-9_$]*';
const acorn = require('acorn');

function maskNonCode(source) {
  const text = String(source);
  const output = text.split('');
  let state = 'code';
  let quote = '';

  for (let i = 0; i < text.length; i += 1) {
    const current = text[i];
    const next = text[i + 1];

    if (state === 'lineComment') {
      if (current === '\n' || current === '\r') {
        state = 'code';
      } else {
        output[i] = ' ';
      }
      continue;
    }

    if (state === 'blockComment') {
      if (current === '*' && next === '/') {
        output[i] = ' ';
        output[i + 1] = ' ';
        i += 1;
        state = 'code';
      } else if (current !== '\n' && current !== '\r') {
        output[i] = ' ';
      }
      continue;
    }

    if (state === 'string') {
      if (current === '\\') {
        output[i] = ' ';
        if (i + 1 < text.length && text[i + 1] !== '\n' && text[i + 1] !== '\r') {
          output[i + 1] = ' ';
          i += 1;
        }
      } else if (current === quote) {
        output[i] = ' ';
        state = 'code';
      } else if (current !== '\n' && current !== '\r') {
        output[i] = ' ';
      }
      continue;
    }

    if (current === '/' && next === '/') {
      output[i] = ' ';
      output[i + 1] = ' ';
      i += 1;
      state = 'lineComment';
    } else if (current === '/' && next === '*') {
      output[i] = ' ';
      output[i + 1] = ' ';
      i += 1;
      state = 'blockComment';
    } else if (current === '"' || current === "'") {
      output[i] = ' ';
      quote = current;
      state = 'string';
    }
  }

  return output.join('');
}

function positionRange(source, start, end = start + 1) {
  return {
    start: positionAt(source, start),
    end: positionAt(source, end)
  };
}

function findStructuralDiagnostics(source) {
  const text = String(source);
  const diagnostics = [];
  const stack = [];
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const opening = new Set(Object.keys(pairs));
  const closing = new Set(Object.values(pairs));
  let state = 'code';
  let quote = '';
  let stateStart = -1;
  let regexCharacterClass = false;
  let previousSignificant = '';

  function addDiagnostic(start, end, message) {
    diagnostics.push({
      range: positionRange(text, start, end),
      message,
      code: 'extendscript.syntax',
      severity: 'error'
    });
  }

  function regexMayStart() {
    if (!previousSignificant) return true;
    if ('=([{,:;!?&|'.includes(previousSignificant)) return true;
    return /[A-Za-z_$]/.test(previousSignificant) && /(?:return|case|throw|else|do|typeof|void|delete|new)$/.test(text.slice(0, stateStart));
  }

  for (let i = 0; i < text.length; i += 1) {
    const current = text[i];
    const next = text[i + 1];

    if (state === 'lineComment') {
      if (current === '\n' || current === '\r') state = 'code';
      continue;
    }

    if (state === 'blockComment') {
      if (current === '*' && next === '/') {
        i += 1;
        state = 'code';
      }
      continue;
    }

    if (state === 'string') {
      if (current === '\\') {
        i += 1;
      } else if (current === quote) {
        state = 'code';
        previousSignificant = quote;
      } else if (current === '\n' || current === '\r') {
        addDiagnostic(stateStart, stateStart + 1, `Unterminated ${quote === '`' ? 'template' : 'string'} literal.`);
        state = 'code';
      }
      continue;
    }

    if (state === 'regex') {
      if (current === '\\') {
        i += 1;
      } else if (current === '[') {
        regexCharacterClass = true;
      } else if (current === ']' && regexCharacterClass) {
        regexCharacterClass = false;
      } else if (current === '/' && !regexCharacterClass) {
        state = 'code';
        previousSignificant = '/';
      } else if (current === '\n' || current === '\r') {
        addDiagnostic(stateStart, stateStart + 1, 'Unterminated regular expression literal.');
        state = 'code';
      }
      continue;
    }

    if (current === '/' && next === '/') {
      i += 1;
      state = 'lineComment';
      continue;
    }
    if (current === '/' && next === '*') {
      i += 1;
      state = 'blockComment';
      stateStart = i - 1;
      continue;
    }
    if (current === '"' || current === "'" || current === '`') {
      state = 'string';
      quote = current;
      stateStart = i;
      continue;
    }
    if (current === '/' && regexMayStart()) {
      state = 'regex';
      stateStart = i;
      regexCharacterClass = false;
      continue;
    }

    if (opening.has(current)) {
      stack.push({ character: current, index: i });
    } else if (closing.has(current)) {
      const expected = stack.length ? pairs[stack[stack.length - 1].character] : null;
      if (!expected) {
        addDiagnostic(i, i + 1, `Unexpected closing '${current}'.`);
      } else if (expected !== current) {
        addDiagnostic(i, i + 1, `Mismatched closing '${current}'; expected '${expected}'.`);
        stack.pop();
      } else {
        stack.pop();
      }
    }

    if (!/\s/.test(current)) previousSignificant = current;
  }

  if (state === 'string') {
    addDiagnostic(stateStart, stateStart + 1, `Unterminated ${quote === '`' ? 'template' : 'string'} literal.`);
  } else if (state === 'blockComment') {
    addDiagnostic(stateStart, stateStart + 2, 'Unterminated block comment.');
  } else if (state === 'regex') {
    addDiagnostic(stateStart, stateStart + 1, 'Unterminated regular expression literal.');
  }

  for (const unmatched of stack.reverse()) {
    addDiagnostic(
      unmatched.index,
      unmatched.index + 1,
      `Unclosed '${unmatched.character}'; expected '${pairs[unmatched.character]}'.`
    );
  }

  return diagnostics;
}

function maskRange(output, start, end) {
  for (let i = start; i < end && i < output.length; i += 1) {
    if (output[i] !== '\n' && output[i] !== '\r') output[i] = ' ';
  }
}

function maskExtendScriptSyntax(source) {
  const text = String(source);
  const output = text.split('');

  for (const directive of text.matchAll(/^[ \t]*#[^\r\n]*/gm)) {
    maskRange(output, directive.index, directive.index + directive[0].length);
  }

  for (const each of text.matchAll(/\bfor\s+each\s*(?=\()/g)) {
    const eachStart = each.index + each[0].indexOf('each');
    maskRange(output, eachStart, eachStart + 4);
  }

  function previousSignificant(index) {
    for (let i = index - 1; i >= 0; i -= 1) {
      if (!/\s/.test(text[i])) return text[i];
    }
    return '';
  }

  function likelyXmlStart(index) {
    const next = text[index + 1];
    if (!(next === '/' || /[A-Za-z_]/.test(next))) return false;
    const previous = previousSignificant(index);
    return !previous || '=(:,[!&|?{;'.includes(previous);
  }

  let searchFrom = 0;
  while (searchFrom < text.length) {
    const start = text.indexOf('<', searchFrom);
    if (start < 0 || !likelyXmlStart(start)) break;
    const tail = text.slice(start);
    const opening = tail.match(/^<([A-Za-z_$][A-Za-z0-9_$:.-]*)(?:\s[^<>]*?)?\s*(\/?>)/);
    if (!opening) {
      searchFrom = start + 1;
      continue;
    }

    let end;
    if (opening[2] === '/>') {
      end = start + opening[0].length;
    } else {
      const tagName = opening[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const closing = tail.match(new RegExp(`^<${tagName}(?:\\s[^<>]*?)?\\s*>[\\s\\S]*?<\\/${tagName}\\s*>`));
      if (!closing) {
        searchFrom = start + 1;
        continue;
      }
      end = start + closing[0].length;
    }

    maskRange(output, start, end);
    output[start] = '0';
    searchFrom = end;
  }

  return output.join('');
}

function findParserDiagnostics(source) {
  const text = String(source);
  const parserInput = maskExtendScriptSyntax(text);
  try {
    acorn.parse(parserInput, {
      ecmaVersion: 2020,
      sourceType: 'script',
      allowHashBang: true,
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true
    });
  } catch (error) {
    const start = Number.isInteger(error.pos) ? error.pos : 0;
    const end = Math.min(text.length, start + 1);
    return [{
      range: positionRange(text, start, end),
      message: `Syntax error: ${error.message}`,
      code: 'extendscript.parser',
      severity: 'error'
    }];
  }
  return [];
}

function positionAt(source, offset) {
  const before = source.slice(0, offset);
  const lines = before.split(/\r?\n/);
  return {
    line: lines.length - 1,
    character: lines[lines.length - 1].length
  };
}

function editDistance(left, right) {
  const a = String(left);
  const b = String(right);
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = a[i - 1] === b[j - 1]
        ? previous
        : Math.min(previous + 1, row[j] + 1, row[j - 1] + 1);
      previous = current;
    }
  }
  return row[b.length];
}

function suggestMemberNames(catalog, typeName, memberName, limit = 3) {
  const typeDefinition = catalog.types && catalog.types[typeName];
  const members = typeDefinition && typeDefinition.members;
  if (!members) return [];

  const lowerName = String(memberName).toLowerCase();
  const maxDistance = Math.max(2, Math.ceil(String(memberName).length * 0.4));
  return Object.keys(members)
    .map((name) => ({
      name,
      distance: editDistance(lowerName, name.toLowerCase())
    }))
    .filter((candidate) => candidate.distance <= maxDistance)
    .sort((left, right) => left.distance - right.distance || left.name.localeCompare(right.name))
    .slice(0, limit)
    .map((candidate) => candidate.name);
}

function logicalParts(raw) {
  const tokenPattern = new RegExp(IDENTIFIER, 'g');
  const tokens = [];
  let token;
  while ((token = tokenPattern.exec(raw))) {
    tokens.push({ name: token[0], start: token.index, end: token.index + token[0].length });
  }

  const parts = [];
  let previousEnd = 0;
  for (const tokenInfo of tokens) {
    const between = raw.slice(previousEnd, tokenInfo.start);
    if (/\[\s*\d+\s*\]/.test(between)) {
      parts.push({ name: 'item', start: null, end: null });
    }
    parts.push(tokenInfo);
    previousEnd = tokenInfo.end;
  }
  return parts;
}

function aliasForChain(chain, aliases) {
  return Object.keys(aliases || {})
    .sort((a, b) => b.length - a.length)
    .find((name) => chain === name || chain.startsWith(`${name}.`));
}

function findApiDiagnostics(source, catalog, getVariableAliases, resolveAliasChain, getDefinition) {
  const text = String(source);
  const masked = maskNonCode(text);
  const chainPattern = new RegExp(
    `${IDENTIFIER}(?:\\s*\\([^()]*\\))?(?:(?:\\s*\\.\\s*${IDENTIFIER}(?:\\s*\\([^()]*\\))?)|(?:\\s*\\[\\s*\\d+\\s*\\]))+`,
    'g'
  );
  const diagnostics = [];
  let match;

  while ((match = chainPattern.exec(masked))) {
    const raw = text.slice(match.index, match.index + match[0].length);
    const parts = logicalParts(raw);
    if (parts.length < 2) continue;

    const rawChain = parts.map((part) => part.name).join('.');
    const aliases = getVariableAliases(text, positionAt(text, match.index));
    const alias = aliasForChain(rawChain, aliases);
    const resolvedRawChain = resolveAliasChain(rawChain, aliases);
    const resolvedParts = resolvedRawChain.split('.').filter(Boolean);
    let prefixParts;
    let partIndex;

    if (alias) {
      const aliasTarget = aliases[alias];
      prefixParts = aliasTarget.split('.').filter(Boolean);
      partIndex = rawChain === alias ? parts.length : alias.split('.').length;
    } else {
      prefixParts = [resolvedParts[0]];
      partIndex = 1;
    }

    let prefix = prefixParts.join('.');
    let definition = getDefinition(catalog, prefix);
    const partsToCheck = alias ? parts.slice(partIndex) : parts.slice(1);

    for (const part of partsToCheck) {
      if (part.name === 'item') {
        prefix = `${prefix}.item`;
        definition = getDefinition(catalog, prefix);
        continue;
      }

      if (!definition || !definition.type) break;
      const typeDefinition = catalog.types && catalog.types[definition.type];
      const members = typeDefinition && typeDefinition.members;
      if (!members || !Object.keys(members).length) break;

      if (!members[part.name]) {
        diagnostics.push({
          range: {
            start: positionAt(text, match.index + part.start),
            end: positionAt(text, match.index + part.end)
          },
          message: `Unknown ExtendScript member '${part.name}' on type '${definition.type}'.`,
          code: 'extendscript.unknownMember',
          severity: 'warning'
        });
        break;
      }

      prefix = `${prefix}.${part.name}`;
      definition = members[part.name];
    }
  }

  return diagnostics;
}

module.exports = {
  findApiDiagnostics,
  findParserDiagnostics,
  findStructuralDiagnostics,
  maskNonCode,
  suggestMemberNames
};
