# Flux VS Code Extension

<!-- FLUX:BADGES:BEGIN -->
<p>
  <a href="https://www.npmjs.com/package/@flux-lang/vscode-flux" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/npm.vscode-flux.dark.svg">
      <img alt="@flux-lang/vscode-flux version" src="../../badges/generated/npm.vscode-flux.light.svg">
    </picture>
  </a>
  <a href="https://www.npmjs.com/package/@flux-lang/vscode-flux" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/channel.vscode-flux.stable.dark.svg">
      <img alt="@flux-lang/vscode-flux stable channel" src="../../badges/generated/channel.vscode-flux.stable.light.svg">
    </picture>
  </a>
  <a href="../../LICENSE">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/license.dark.svg">
      <img alt="License" src="../../badges/generated/license.light.svg">
    </picture>
  </a>
  <a href="https://github.com/cbassuarez/flux/commits/main" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/maintained.dark.svg">
      <img alt="Maintained status" src="../../badges/generated/maintained.light.svg">
    </picture>
  </a>
</p>
<!-- FLUX:BADGES:END -->

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
