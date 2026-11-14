const vscode = require('vscode');
const path = require('path');
const { loadCatalog, getDefinition, getMembers } = require('./catalog');
const { getCompletionContext, getVariableAliases, resolveAliasChain } = require('./context');
const { getLanguageCompletions } = require('./language-completions');
const { getLocalSymbols, getLocalMembers } = require('./local-symbols');
const {
  findApiDiagnostics,
  findParserDiagnostics,
  findStructuralDiagnostics,
  suggestMemberNames
} = require('./diagnostics');

let catalog;
let diagnosticCollection;

function hostName() {
  return vscode.workspace.getConfiguration('extendscript').get('host', 'indesign');
}

function customApiPaths() {
  return vscode.workspace.getConfiguration('extendscript').get('apiPaths', []);
}

function reloadCatalog(extensionRoot) {
  catalog = loadCatalog(extensionRoot, hostName(), customApiPaths());
}

function isExtendScriptDocument(document) {
  if (document.languageId === 'extendscript') return true;
  const extension = path.extname(document.fileName).toLowerCase();
  if (extension === '.jsx' || extension === '.jsxinc') return true;
  return document.uri.scheme === 'untitled' && vscode.workspace
    .getConfiguration('extendscript')
    .get('enableInUntitled', true);
}

function updateDiagnostics(document) {
  if (!diagnosticCollection) return;
  if (!isExtendScriptDocument(document)) {
    diagnosticCollection.delete(document.uri);
    return;
  }

  const text = document.getText();
  const structuralDiagnostics = findStructuralDiagnostics(text);
  const results = [
    ...structuralDiagnostics,
    ...(structuralDiagnostics.length ? [] : findParserDiagnostics(text)),
    ...findApiDiagnostics(text, catalog, getVariableAliases, resolveAliasChain, getDefinition)
  ];
  const diagnostics = results.map((result) => {
    const range = new vscode.Range(
      new vscode.Position(result.range.start.line, result.range.start.character),
      new vscode.Position(result.range.end.line, result.range.end.character)
    );
    const severity = result.severity === 'error'
      ? vscode.DiagnosticSeverity.Error
      : vscode.DiagnosticSeverity.Warning;
    const diagnostic = new vscode.Diagnostic(range, result.message, severity);
    diagnostic.code = result.code;
    diagnostic.source = 'ExtendScript';
    return diagnostic;
  });
  diagnosticCollection.set(document.uri, diagnostics);
}

function refreshDiagnostics() {
  for (const document of vscode.workspace.textDocuments) {
    updateDiagnostics(document);
  }
}

function provideCodeActions(document, range, codeActionContext) {
  const actions = [];
  for (const diagnostic of codeActionContext.diagnostics || []) {
    if (diagnostic.code !== 'extendscript.unknownMember') continue;

    const match = diagnostic.message.match(
      /^Unknown ExtendScript member '([^']+)' on type '([^']+)'\.$/
    );
    if (!match) continue;

    const candidates = suggestMemberNames(catalog, match[2], match[1]);
    candidates.forEach((candidate, index) => {
      const action = new vscode.CodeAction(
        `Replace '${match[1]}' with '${candidate}'`,
        vscode.CodeActionKind.QuickFix
      );
      action.diagnostics = [diagnostic];
      action.isPreferred = index === 0;
      action.edit = new vscode.WorkspaceEdit();
      action.edit.replace(document.uri, diagnostic.range, candidate);
      actions.push(action);
    });
  }
  return actions;
}

function completionKind(vscodeApi, definition) {
  if (definition.kind === 'keyword') return vscodeApi.CompletionItemKind.Keyword;
  if (definition.kind === 'function') return vscodeApi.CompletionItemKind.Function;
  if (definition.kind === 'class') return vscodeApi.CompletionItemKind.Class;
  if (definition.kind === 'method') return vscodeApi.CompletionItemKind.Method;
  if (definition.kind === 'event') return vscodeApi.CompletionItemKind.Event;
  if (definition.kind === 'constant') return vscodeApi.CompletionItemKind.Constant;
  if (definition.kind === 'snippet') return vscodeApi.CompletionItemKind.Snippet;
  return vscodeApi.CompletionItemKind.Property;
}

function completionItem(name, definition) {
  const item = new vscode.CompletionItem(name, completionKind(vscode, definition));
  item.detail = definition.detail || definition.type || '';
  if (definition.documentation) {
    item.documentation = new vscode.MarkdownString(definition.documentation);
  }
  if (definition.insertText !== undefined) {
    item.insertText = definition.snippet
      ? new vscode.SnippetString(definition.insertText)
      : definition.insertText;
  } else if (definition.kind === 'method' || definition.kind === 'class' || definition.kind === 'function') {
    const parameters = definition.parameters || '';
    item.insertText = new vscode.SnippetString(`${name}(${parameters}${parameters ? ', ' : ''}$0)`);
    item.command = {
      command: 'editor.action.triggerParameterHints',
      title: 'Trigger Parameter Hints'
    };
  }
  return item;
}

function provideCompletions(document, position) {
  const context = getCompletionContext(document.getText(), position);
  const localSymbols = getLocalSymbols(document.getText());
  const aliases = getVariableAliases(document.getText(), position);
  const resolvedChain = resolveAliasChain(context.chain, aliases);
  let source;
  if (context.objectLiteral) {
    const method = getDefinition(catalog, resolvedChain);
    const propertyType = method && (method.propertiesType || method.type);
    source = propertyType ? getMembers(catalog, propertyType) : {};
  } else {
    if (context.memberAccess) {
      const definition = getDefinition(catalog, resolvedChain);
      source = {
        ...getMembers(catalog, resolvedChain),
        ...getLocalMembers(localSymbols, resolvedChain, definition && definition.type)
      };
    } else {
      source = {...getLanguageCompletions(), ...(catalog.globals || {}), ...localSymbols.globals};
    }
  }
  const typed = context.typed.toLowerCase();

  return Object.entries(source)
    .filter(([name]) => !typed || name.toLowerCase().startsWith(typed))
    .map(([name, definition]) => completionItem(name, definition));
}

function provideHover(document, position) {
  const word = document.getWordRangeAtPosition(position, /[A-Za-z_$][A-Za-z0-9_$]*/);
  if (!word) return undefined;

  const context = getCompletionContext(document.getText(), position);
  const line = document.lineAt(position.line).text;
  const beforeWord = line.slice(0, word.start.character);
  const beforeContext = getCompletionContext(document.getText(), {
    line: position.line,
    character: word.start.character
  });
  const aliases = getVariableAliases(document.getText(), {
    line: position.line,
    character: word.start.character
  });
  const name = document.getText(word);
  let definition;

  if (beforeContext.memberAccess || /\.\s*$/.test(beforeWord)) {
    const chain = resolveAliasChain(beforeContext.chain, aliases);
    const members = getMembers(catalog, chain);
    definition = members[name];
  } else {
    definition = catalog.globals && catalog.globals[name];
  }

  if (!definition) return undefined;

  const markdown = new vscode.MarkdownString();
  markdown.appendCodeblock(`${name}${definition.kind === 'method' ? `(${definition.parameters || ''})` : ''}`, 'javascript');
  if (definition.type) markdown.appendMarkdown(`**Type:** \`${definition.type}\`\n\n`);
  if (definition.documentation) markdown.appendMarkdown(definition.documentation);
  markdown.appendMarkdown(`\n\n*Host profile: ${catalog.host}*`);
  return new vscode.Hover(markdown, word);
}

function documentSelector() {
  const selector = [
    { language: 'extendscript', scheme: 'file' },
    { language: 'extendscript', scheme: 'untitled' }
  ];
  const enableInUntitled = vscode.workspace
    .getConfiguration('extendscript')
    .get('enableInUntitled', true);
  if (enableInUntitled) {
    selector.push({ language: 'plaintext', scheme: 'untitled' });
    selector.push({ language: 'javascript', scheme: 'untitled' });
  }
  return selector;
}

function activate(context) {
  const extensionRoot = path.resolve(__dirname, '..');
  reloadCatalog(extensionRoot);
  diagnosticCollection = vscode.languages.createDiagnosticCollection('extendscript');

  const selector = documentSelector();
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    selector,
    { provideCompletionItems: provideCompletions },
    '.'
  );
  const hoverProvider = vscode.languages.registerHoverProvider(selector, { provideHover });
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    selector,
    { provideCodeActions },
    { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
  );
  const reloadCommand = vscode.commands.registerCommand('extendscript.reloadApi', () => {
    reloadCatalog(extensionRoot);
    vscode.window.showInformationMessage(`ExtendScript API catalog reloaded for ${catalog.host}.`);
  });
  const useForCurrentFileCommand = vscode.commands.registerCommand('extendscript.useForCurrentFile', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    await vscode.languages.setTextDocumentLanguage(editor.document, 'extendscript');
    vscode.window.showInformationMessage('Current file is now treated as ExtendScript.');
  });
  const configurationWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('extendscript')) {
      reloadCatalog(extensionRoot);
      refreshDiagnostics();
    }
  });
  const openDocumentWatcher = vscode.workspace.onDidOpenTextDocument(updateDiagnostics);
  const changeDocumentWatcher = vscode.workspace.onDidChangeTextDocument((event) => {
    updateDiagnostics(event.document);
  });
  const closeDocumentWatcher = vscode.workspace.onDidCloseTextDocument((document) => {
    diagnosticCollection.delete(document.uri);
  });

  refreshDiagnostics();

  context.subscriptions.push(
    diagnosticCollection,
    completionProvider,
    hoverProvider,
    codeActionProvider,
    reloadCommand,
    useForCurrentFileCommand,
    configurationWatcher,
    openDocumentWatcher,
    changeDocumentWatcher,
    closeDocumentWatcher
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
  provideCompletions,
  provideHover
};
