"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
var import_core = require("@flux-lang/core");
var DIAGNOSTIC_SOURCE_PARSE = "flux-parser";
var DIAGNOSTIC_SOURCE_CHECK = "flux-check";
var diagnosticCollection;
var debounceTimers = /* @__PURE__ */ new Map();
function activate(context) {
  diagnosticCollection = vscode.languages.createDiagnosticCollection("flux");
  context.subscriptions.push(diagnosticCollection);
  for (const doc of vscode.workspace.textDocuments) {
    if (doc.languageId === "flux") {
      validateDocument(doc);
    }
  }
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.languageId === "flux") {
        validateDocument(doc);
      }
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const doc = event.document;
      if (doc.languageId !== "flux") return;
      const key = doc.uri.toString();
      const existing = debounceTimers.get(key);
      if (existing) {
        clearTimeout(existing);
      }
      const timer = setTimeout(() => {
        debounceTimers.delete(key);
        validateDocument(doc);
      }, 400);
      debounceTimers.set(key, timer);
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.languageId === "flux") {
        validateDocument(doc);
      }
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("flux.showIR", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        void vscode.window.showInformationMessage(
          "No active editor."
        );
        return;
      }
      const doc = editor.document;
      if (doc.languageId !== "flux") {
        void vscode.window.showInformationMessage(
          "Active document is not a Flux file."
        );
        return;
      }
      const text = doc.getText();
      let ir;
      try {
        ir = (0, import_core.parseDocument)(text);
      } catch (err) {
        const msg = err?.message ?? "Unknown parse error.";
        void vscode.window.showErrorMessage(
          `Flux parse error: ${msg}`
        );
        return;
      }
      const json = JSON.stringify(ir, null, 2);
      const irDoc = await vscode.workspace.openTextDocument({
        language: "json",
        content: json
      });
      await vscode.window.showTextDocument(irDoc, {
        preview: true
      });
    })
  );
}
function deactivate() {
  if (diagnosticCollection) {
    diagnosticCollection.dispose();
    diagnosticCollection = void 0;
  }
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
}
function validateDocument(doc) {
  if (!diagnosticCollection) return;
  if (doc.languageId !== "flux") return;
  const diagnostics = [];
  const text = doc.getText();
  let parsed = null;
  try {
    parsed = (0, import_core.parseDocument)(text);
  } catch (err) {
    const diag = createParseDiagnostic(doc, err);
    diagnostics.push(diag);
    diagnosticCollection.set(doc.uri, diagnostics);
    return;
  }
  try {
    const messages = (0, import_core.checkDocument)(doc.uri.fsPath || "<memory>", parsed);
    for (const message of messages) {
      const diag = createCheckDiagnostic(doc, message);
      diagnostics.push(diag);
    }
  } catch (err) {
    const msg = err?.message ?? "Unknown static check failure.";
    const diag = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 1),
      `Static checks failed: ${msg}`,
      vscode.DiagnosticSeverity.Warning
    );
    diag.source = DIAGNOSTIC_SOURCE_CHECK;
    diagnostics.push(diag);
  }
  diagnosticCollection.set(doc.uri, diagnostics);
}
function createParseDiagnostic(doc, error) {
  const message = error?.message ?? String(error);
  const parseMatch = /Parse error at (\d+):(\d+) near '([^']*)': (.*)/.exec(message);
  if (parseMatch) {
    const [, lineStr, colStr, near, detail] = parseMatch;
    const line = Math.max(0, Number(lineStr) - 1);
    const col = Math.max(0, Number(colStr) - 1);
    const range = safeRange(doc, line, col);
    const diag2 = new vscode.Diagnostic(
      range,
      `Parse error near '${near}': ${detail}`,
      vscode.DiagnosticSeverity.Error
    );
    diag2.source = DIAGNOSTIC_SOURCE_PARSE;
    return diag2;
  }
  const diag = new vscode.Diagnostic(
    new vscode.Range(0, 0, 0, 1),
    message,
    vscode.DiagnosticSeverity.Error
  );
  diag.source = DIAGNOSTIC_SOURCE_PARSE;
  return diag;
}
function createCheckDiagnostic(doc, line) {
  const match = /^.*?:(\d+):(\d+):\s*(.*)$/.exec(line);
  if (!match) {
    const diag2 = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 1),
      line,
      vscode.DiagnosticSeverity.Warning
    );
    diag2.source = DIAGNOSTIC_SOURCE_CHECK;
    return diag2;
  }
  const [, lineStr, colStr, rest] = match;
  const lineNum = Math.max(0, Number(lineStr) - 1);
  const colNum = Math.max(0, Number(colStr) - 1);
  const message = rest;
  const range = safeRange(doc, lineNum, colNum);
  const diag = new vscode.Diagnostic(
    range,
    message,
    vscode.DiagnosticSeverity.Warning
  );
  diag.source = DIAGNOSTIC_SOURCE_CHECK;
  return diag;
}
function safeRange(doc, line, col) {
  const clampedLine = Math.min(
    Math.max(line, 0),
    Math.max(doc.lineCount - 1, 0)
  );
  const textLine = doc.lineAt(clampedLine);
  const maxCol = textLine.text.length;
  const clampedCol = Math.min(Math.max(col, 0), maxCol);
  return new vscode.Range(
    clampedLine,
    clampedCol,
    clampedLine,
    clampedCol + 1
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
