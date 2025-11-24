#!/usr/bin/env node

import fs from "node:fs/promises";
import { stdin as nodeStdin } from "node:process";
import {
    parseDocument,
    initRuntimeState,
    checkDocument,
} from "@flux-lang/core";
import type { FluxDocument } from "@flux-lang/core";


type ExitCode = 0 | 1 | 2;

const VERSION = "0.1.0";

interface ParseOptions {
    ndjson: boolean;
    pretty: boolean;
    compact: boolean;
}

interface CheckOptions {
    json: boolean;
}

interface CheckResult {
    file: string;
    ok: boolean;
    errors?: string[];
}

// Entry
void (async () => {
    try {
        const code = await main(process.argv.slice(2));
        if (code !== 0) {
            process.exit(code);
        }
    } catch (error) {
        const msg = (error as Error)?.message ?? String(error);
        console.error(`Internal error: ${msg}`);
        process.exit(2);
    }
})();

async function main(argv: string[]): Promise<ExitCode> {
    if (argv.length === 0) {
        printGlobalHelp();
        return 0;
    }

    // Global --help / -h
    if (argv.includes("-h") || argv.includes("--help")) {
        const idx = argv.findIndex((a) => a === "-h" || a === "--help");
        // No subcommand yet → global
        if (idx === 0) {
            printGlobalHelp();
            return 0;
        }
        const cmd = argv[0];
        if (cmd === "parse") {
            printParseHelp();
        } else if (cmd === "check") {
            printCheckHelp();
        } else {
            printGlobalHelp();
        }
        return 0;
    }

    // Global --version / -v
    if (argv.includes("-v") || argv.includes("--version")) {
        console.log(`flux v${VERSION}`);
        return 0;
    }

    const [cmd, ...rest] = argv;

    if (cmd === "parse") {
        return runParse(rest);
    }

    if (cmd === "check") {
        return runCheck(rest);
    }

    console.error(`Unknown command '${cmd}'.`);
    printGlobalHelp();
    return 1;
}

/* -------------------------------------------------------------------------- */
/*                                  Help text                                 */
/* -------------------------------------------------------------------------- */

function printGlobalHelp(): void {
    console.log(
        [
            `Flux CLI v${VERSION}`,
            "",
            "Usage:",
            "  flux parse [options] <files...>",
            "  flux check [options] <files...>",
            "",
            "Commands:",
            "  parse   Parse Flux source files and print their IR as JSON.",
            "  check   Parse and run basic static checks.",
            "",
            "Global options:",
            "  -h, --help      Show this help message.",
            "  -v, --version   Show CLI version.",
            "",
        ].join("\n"),
    );
}

function printParseHelp(): void {
    console.log(
        [
            "Usage:",
            "  flux parse [options] <files...>",
            "",
            "Description:",
            "  Parse Flux source files and print their IR as JSON.",
            "",
            "Options:",
            "  --ndjson    Emit one JSON object per line: { \"file\", \"doc\" }.",
            "  --pretty    Pretty-print JSON (2-space indent). (default for a single file)",
            "  --compact   Compact JSON (no whitespace).",
            "  -h, --help  Show this message.",
            "",
        ].join("\n"),
    );
}

function printCheckHelp(): void {
    console.log(
        [
            "Usage:",
            "  flux check [options] <files...>",
            "",
            "Description:",
            "  Parse Flux files and run basic static checks (grid references,",
            "  neighbors.* usage, and runtime shape).",
            "",
            "Options:",
            "  --json      Emit NDJSON diagnostics to stdout.",
            "  -h, --help  Show this message.",
            "",
        ].join("\n"),
    );
}

/* -------------------------------------------------------------------------- */
/*                                 flux parse                                 */
/* -------------------------------------------------------------------------- */

async function runParse(args: string[]): Promise<ExitCode> {
    const opts: ParseOptions = {
        ndjson: false,
        pretty: false,
        compact: false,
    };
    const files: string[] = [];

    for (const arg of args) {
        if (arg === "--ndjson") {
            opts.ndjson = true;
        } else if (arg === "--pretty") {
            opts.pretty = true;
        } else if (arg === "--compact") {
            opts.compact = true;
        } else {
            files.push(arg);
        }
    }

    if (files.length === 0) {
        console.error("flux parse: No input files specified.");
        printParseHelp();
        return 1;
    }

    const usesStdin = files.includes("-");
    if (usesStdin && files.length > 1) {
        console.error("flux parse: '-' (stdin) can only be used with a single input.");
        return 1;
    }

    if (opts.pretty && opts.compact && !opts.ndjson) {
        console.error("flux parse: --pretty and --compact are mutually exclusive.");
        return 1;
    }

    const docs: { file: string; doc: FluxDocument }[] = [];

    for (const file of files) {
        let source: string;
        try {
            source = await readSource(file);
        } catch (error) {
            const msg = formatIoError(file, error);
            console.error(msg);
            return 1;
        }

        try {
            const doc = parseDocument(source);
            docs.push({ file: file === "-" ? "<stdin>" : file, doc });
        } catch (error) {
            const msg = formatParseOrLexerError(file, error);
            console.error(msg);
            return 1;
        }
    }

    const useNdjson = opts.ndjson || docs.length > 1;

    if (useNdjson) {
        for (const item of docs) {
            const payload = { file: item.file, doc: item.doc };
            process.stdout.write(JSON.stringify(payload) + "\n");
        }
        return 0;
    }

    // Single file → pretty by default unless compact explicitly requested
    const doc = docs[0].doc;
    const space = opts.compact ? 0 : 2;
    const json = JSON.stringify(doc, null, space);
    process.stdout.write(json + "\n");
    return 0;
}

/* -------------------------------------------------------------------------- */
/*                                 flux check                                 */
/* -------------------------------------------------------------------------- */

async function runCheck(args: string[]): Promise<ExitCode> {
    const opts: CheckOptions = {
        json: false,
    };
    const files: string[] = [];

    for (const arg of args) {
        if (arg === "--json") {
            opts.json = true;
        } else {
            files.push(arg);
        }
    }

    if (files.length === 0) {
        console.error("flux check: No input files specified.");
        printCheckHelp();
        return 1;
    }

    const results: CheckResult[] = [];

    for (const file of files) {
        let source: string;
        try {
            source = await readSource(file);
        } catch (error) {
            const diagnostic = formatIoError(file, error);
            results.push({
                file,
                ok: false,
                errors: [diagnostic],
            });
            continue;
        }

        let doc: FluxDocument;
        try {
            doc = parseDocument(source);
        } catch (error) {
            const diagnostic = formatParseOrLexerError(file, error);
            results.push({
                file,
                ok: false,
                errors: [diagnostic],
            });
            continue;
        }

        const errors: string[] = [];

        // initRuntimeState smoke check — should not throw for valid IR.
        try {
            initRuntimeState(doc);
        } catch (error) {
            const detail = (error as Error)?.message ?? String(error);
            errors.push(
                `${file}:0:0: Check error: initRuntimeState failed: ${detail}`,
            );
        }

        // Static checks (grids, neighbors, timers, etc.)
        errors.push(...checkDocument(file, doc));

        results.push({
            file,
            ok: errors.length === 0,
            errors: errors.length ? errors : undefined,
        });
    }

    const failed = results.filter((r) => !r.ok);
    const hasFailure = failed.length > 0;

    // JSON (NDJSON) diagnostics
    if (opts.json) {
        for (const r of results) {
            const payload: {
                file: string;
                ok: boolean;
                errors?: { message: string }[];
            } = {
                file: r.file,
                ok: r.ok,
            };
            if (r.errors) {
                payload.errors = r.errors.map((message) => ({ message }));
            }
            process.stdout.write(JSON.stringify(payload) + "\n");
        }
        return hasFailure ? 1 : 0;
    }

    // Human-readable: diagnostics per failing file + summary
    for (const r of results) {
        if (!r.errors) continue;
        for (const msg of r.errors) {
            console.error(msg);
        }
    }

    if (hasFailure) {
        console.log(`✗ ${failed.length} of ${results.length} files failed checks`);
        return 1;
    }

    console.log(`✓ ${results.length} files OK`);
    return 0;
}

/* -------------------------------------------------------------------------- */
/*                               I/O + errors                                 */
/* -------------------------------------------------------------------------- */

async function readSource(file: string): Promise<string> {
    if (file === "-") {
        return readAllFromStdin();
    }
    return fs.readFile(file, "utf8");
}

function readAllFromStdin(): Promise<string> {
    return new Promise((resolve, reject) => {
        let data = "";
        nodeStdin.setEncoding("utf8");
        nodeStdin.on("data", (chunk) => {
            data += chunk;
        });
        nodeStdin.on("error", reject);
        nodeStdin.on("end", () => resolve(data));
    });
}

function formatIoError(file: string, error: unknown): string {
    const err = error as { code?: string };
    const code = err.code ?? "UNKNOWN";
    return `${file}:0:0: Error: Cannot read file (${code})`;
}

function formatParseOrLexerError(file: string, error: unknown): string {
    const err = error as Error;
    const message = err?.message ?? String(error);

    const parseMatch =
        /Parse error at (\d+):(\d+) near '([^']*)': (.*)/.exec(message);
    if (parseMatch) {
        const [, line, column, near, detail] = parseMatch;
        return `${file}:${line}:${column}: Parse error near '${near}': ${detail}`;
    }

    const lexMatch =
        /Lexer error at (\d+):(\d+)\s*-\s*(.*)/.exec(message);
    if (lexMatch) {
        const [, line, column, detail] = lexMatch;
        return `${file}:${line}:${column}: Lexer error: ${detail}`;
    }

    return `${file}:0:0: ${message}`;
}
