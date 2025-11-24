// packages/vscode-flux/src/extension.ts
import * as vscode from "vscode";
import { parseDocument, checkDocument } from "@flux-lang/core";

const DIAGNOSTIC_SOURCE_PARSE = "flux-parser";
const DIAGNOSTIC_SOURCE_CHECK = "flux-check";

let diagnosticCollection: vscode.DiagnosticCollection | undefined;
const debounceTimers = new Map<string, NodeJS.Timeout>();

export function activate(context: vscode.ExtensionContext): void {
    diagnosticCollection =
        vscode.languages.createDiagnosticCollection("flux");
    context.subscriptions.push(diagnosticCollection);

    // Validate already-open Flux docs
    for (const doc of vscode.workspace.textDocuments) {
        if (doc.languageId === "flux") {
            validateDocument(doc);
        }
    }

    // On open
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((doc) => {
            if (doc.languageId === "flux") {
                validateDocument(doc);
            }
        }),
    );

    // On change (debounced)
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
        }),
    );

    // On save (immediate)
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument((doc) => {
            if (doc.languageId === "flux") {
                validateDocument(doc);
            }
        }),
    );

    // Command: flux.showIR
    context.subscriptions.push(
        vscode.commands.registerCommand("flux.showIR", async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                void vscode.window.showInformationMessage(
                    "No active editor.",
                );
                return;
            }

            const doc = editor.document;
            if (doc.languageId !== "flux") {
                void vscode.window.showInformationMessage(
                    "Active document is not a Flux file.",
                );
                return;
            }

            const text = doc.getText();
            let ir: unknown;

            try {
                ir = parseDocument(text);
            } catch (err) {
                const msg =
                    (err as Error)?.message ?? "Unknown parse error.";
                void vscode.window.showErrorMessage(
                    `Flux parse error: ${msg}`,
                );
                return;
            }

            const json = JSON.stringify(ir, null, 2);
            const irDoc = await vscode.workspace.openTextDocument({
                language: "json",
                content: json,
            });
            await vscode.window.showTextDocument(irDoc, {
                preview: true,
            });
        }),
    );
}

export function deactivate(): void {
    if (diagnosticCollection) {
        diagnosticCollection.dispose();
        diagnosticCollection = undefined;
    }
    for (const timer of debounceTimers.values()) {
        clearTimeout(timer);
    }
    debounceTimers.clear();
}

/* -------------------------------------------------------------------------- */
/*                             Validation helpers                             */
/* -------------------------------------------------------------------------- */

function validateDocument(doc: vscode.TextDocument): void {
    if (!diagnosticCollection) return;
    if (doc.languageId !== "flux") return;

    const diagnostics: vscode.Diagnostic[] = [];

    const text = doc.getText();
    let parsed: any | null = null;

    // 1) Try parse
    try {
        parsed = parseDocument(text);
    } catch (err) {
        const diag = createParseDiagnostic(doc, err);
        diagnostics.push(diag);
        diagnosticCollection.set(doc.uri, diagnostics);
        return;
    }

    // 2) Run static checks via checkDocument
    try {
        const messages = checkDocument(doc.uri.fsPath || "<memory>", parsed);
        for (const message of messages) {
            const diag = createCheckDiagnostic(doc, message);
            diagnostics.push(diag);
        }
    } catch (err) {
        // checkDocument should not throw for valid IR, but guard anyway
        const msg =
            (err as Error)?.message ?? "Unknown static check failure.";
        const diag = new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 1),
            `Static checks failed: ${msg}`,
            vscode.DiagnosticSeverity.Warning,
        );
        diag.source = DIAGNOSTIC_SOURCE_CHECK;
        diagnostics.push(diag);
    }

    diagnosticCollection.set(doc.uri, diagnostics);
}

function createParseDiagnostic(
    doc: vscode.TextDocument,
    error: unknown,
): vscode.Diagnostic {
    const message = (error as Error)?.message ?? String(error);

    // Try to match the parser’s error format:
    // "Parse error at line:col near '...' : detail"
    const parseMatch =
        /Parse error at (\d+):(\d+) near '([^']*)': (.*)/.exec(message);
    if (parseMatch) {
        const [, lineStr, colStr, near, detail] = parseMatch;
        const line = Math.max(0, Number(lineStr) - 1);
        const col = Math.max(0, Number(colStr) - 1);

        const range = safeRange(doc, line, col);
        const diag = new vscode.Diagnostic(
            range,
            `Parse error near '${near}': ${detail}`,
            vscode.DiagnosticSeverity.Error,
        );
        diag.source = DIAGNOSTIC_SOURCE_PARSE;
        return diag;
    }

    // Fallback: pin to 0:0
    const diag = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 1),
        message,
        vscode.DiagnosticSeverity.Error,
    );
    diag.source = DIAGNOSTIC_SOURCE_PARSE;
    return diag;
}

function createCheckDiagnostic(
    doc: vscode.TextDocument,
    line: string,
): vscode.Diagnostic {
    // checkDocument emits lines like:
    // path/to/file.flux:0:0: Check error: ...
    const match = /^.*?:(\d+):(\d+):\s*(.*)$/.exec(line);
    if (!match) {
        const diag = new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 1),
            line,
            vscode.DiagnosticSeverity.Warning,
        );
        diag.source = DIAGNOSTIC_SOURCE_CHECK;
        return diag;
    }

    const [, lineStr, colStr, rest] = match;
    const lineNum = Math.max(0, Number(lineStr) - 1);
    const colNum = Math.max(0, Number(colStr) - 1);

    const message = rest; // keep "Check error: ..." prefix for now

    const range = safeRange(doc, lineNum, colNum);
    const diag = new vscode.Diagnostic(
        range,
        message,
        vscode.DiagnosticSeverity.Warning,
    );
    diag.source = DIAGNOSTIC_SOURCE_CHECK;
    return diag;
}

function safeRange(
    doc: vscode.TextDocument,
    line: number,
    col: number,
): vscode.Range {
    const clampedLine = Math.min(
        Math.max(line, 0),
        Math.max(doc.lineCount - 1, 0),
    );
    const textLine = doc.lineAt(clampedLine);
    const maxCol = textLine.text.length;
    const clampedCol = Math.min(Math.max(col, 0), maxCol);
    return new vscode.Range(
        clampedLine,
        clampedCol,
        clampedLine,
        clampedCol + 1,
    );
}

