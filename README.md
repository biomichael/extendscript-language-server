# ExtendScript Language Server
This project aims to create a feature complete [language server](https://microsoft.github.io/language-server-protocol/).
This would allow for easy integration of ExtendScript into code editors like Visual Studio Code, Vim, Neovim, Emacs, Jetbrains IDEs, etc. 

## Current direction

The uploaded InDesign 14 HTML reference is the preferred source for the InDesign catalog. To regenerate it after replacing or updating that reference folder, run:

```bash
npm run generate:indesign -- ./indesign14 ./data/indesign.generated.json
```

The generated catalog covers hundreds of InDesign classes and enumerations, including method signatures, property types, documentation, collection helpers, and object-literal types for methods such as `rectangles.add({ geometricBounds: ... })`.

The first distributable target is a Visual Studio Code extension. It provides autocomplete and hover documentation for `.jsx` and `.jsxinc` files, with selectable Adobe host profiles. The initial implementation is intentionally small and tolerant of ExtendScript syntax; a full parser and richer language-server features can be added after the completion workflow is useful.

The current profiles prioritize InDesign and Photoshop, followed by Illustrator and the other Adobe hosts. They include common ExtendScript objects such as `File`, `Folder`, `BridgeTalk`, `UnitValue`, and `$`. The supplied SDK, CHM references, and real-world scripts are being used as the source material for expanding the generated API catalogs.

The extension also includes the ExtendScript syntax grammar and snippet library from [ExtendScript for Visual Studio Code](https://github.com/Hennamann/ExtendScript-for-Visual-Studio-Code). These assets improve syntax coloring and common code templates; API-aware completion still comes from this project's custom resolver.

It also reports warnings for unknown members when the object type can be resolved from the selected API catalog. For example, `app.activeDocument.textFrames.everItem()` is flagged because the valid method is `everyItem()`. Dynamic expressions and ordinary JavaScript are left alone when the type cannot be determined confidently.

Basic syntax diagnostics are included as well. The extension reports unmatched or mismatched `()`, `[]`, and `{}` delimiters, ordinary JavaScript syntax errors, unterminated strings, regular expressions, and block comments while ignoring those characters inside comments, strings, and regular expressions. The parser is configured to tolerate common ExtendScript directives, `for each`, and basic E4X XML literals.

### Try the extension during development

Open this repository in VS Code and press `F5` to launch an Extension Development Host. Create or open a `.jsx` file and try completions after expressions such as:

```javascript
app.
app.activeDocument.
app.activeDocument.pages.item(0).
new File("example.txt").
```

The bundled snippets include templates for `#target`, `#include`, `app.doScript`, InDesign find/change operations, ScriptUI palettes, and common layout operations.

Select the Adobe host with the `extendscript.host` setting. The initial host choices are InDesign, Photoshop, InDesign Server, InCopy, and Illustrator.

For an unsaved `Untitled-1` editor, completion is enabled by default. You can also run **ExtendScript: Use for Current File** from the Command Palette to switch its language mode explicitly. Saving the file with a `.jsx` or `.jsxinc` extension will select ExtendScript automatically.

### Package a VSIX

Install dependencies and run the packaging command:

```bash
npm install
npx vsce package
```

This produces a file such as `extendscript-language-server-0.1.0.vsix`, which can be installed from VS Code's Extensions view using **Install from VSIX...**.

## The Challenge
To date there are 2(3) language servers for Javascript all based on ES6 or newer:

* Javascript/Typescript Language Server built into VSCode
* [Sourcegraphs Javascript/Typescript Language Server](https://github.com/sourcegraph/javascript-typescript-langserver)
* [Flowtypes Flow Javascript Language Server](https://github.com/flowtype/flow-for-vscode)

All of these work great for Javascript and Typescript, but due to ExtendScripts old E4X/Ecmascript 4 limitations they do cause issues with ExtendScript code.

This also means there's no existing Language Server to base ours on, giving us two options:

* Make a brand new language server from scratch specifically for ExtendScript (Possibly making a plain E4X and ES4 as well, because why not?)
* Use one of the existing Javascript Language Servers as a basis and add and remove features to shape it into an ExtendScript language server.

Of the two options the first one is the most enticing, but also the one that will require the most work, the second one could lead to issues and might not be a perfect solution, especially not longterm.

## I need help
While i do use ExtendScript on a semi-frequent basis, i am far from an expert on the language, which is why i'm asking all of you talented ExtendScript efficianados out there to help bring this project to reality. Any help is appreciated!

## More info to come (hopefully)

