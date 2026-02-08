# Flux VS Code Extension
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/cbassuarez.flux-language-support)](https://marketplace.visualstudio.com/items?itemName=cbassuarez.flux-language-support)
[![VS Code Installs](https://img.shields.io/visual-studio-marketplace/i/cbassuarez.flux-language-support)](https://marketplace.visualstudio.com/items?itemName=cbassuarez.flux-language-support)
[![Flux Spec](https://img.shields.io/badge/Flux-spec-00CDFE)](../../spec/overview.md)
[![License: MIT](https://img.shields.io/github/license/cbassuarez/flux)](../../LICENSE)

1) **What this package is**
   Language support for the Flux score language (syntax highlighting + diagnostics).

2) **When you use it**
   Use it in VS Code to edit `.flux` files with syntax and diagnostic support.

3) **Install**

```bash
code --install-extension cbassuarez.flux-language-support
```

4) **Basic usage**
- Open a `.flux` file and run the command **Flux: Show IR JSON for Current File**.

5) **Reference**
- **Language ID**: `flux`
- **File extension**: `.flux`
- **Command**: `flux.showIR` (shows IR JSON for the current file)

6) **How it relates to IR/runtime**
The extension uses `@flux-lang/core` to parse documents and surface diagnostics/IR tooling inside the editor.

7) **Gotchas & troubleshooting**
- The extension only activates for `.flux` files.

8) **Versioning / compatibility notes**
TBD / Not yet implemented.

9) **Links**
- Root Flux manual: [`../../README.md`](../../README.md)
- Extension package.json: [`package.json`](package.json)
- Source: [`src/`](src/)
