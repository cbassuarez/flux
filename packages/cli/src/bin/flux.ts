#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { stdin as nodeStdin } from "node:process";
import {
    parseDocument,
    initRuntimeState,
    checkDocument,
    createRuntime,
    createDocumentRuntime,
    renderDocument,
    renderDocumentIR,
    type Runtime,
} from "@flux-lang/core";
import type { FluxDocument } from "@flux-lang/core";
import { renderHtml } from "@flux-lang/render-html";
import { createTypesetterBackend } from "@flux-lang/typesetter";
import { startViewerServer } from "@flux-lang/viewer";
import { runViewer } from "../view/runViewer.js";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";


type ExitCode = 0 | 1 | 2;

const VERSION = "0.2.0";

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
        } else if (cmd === "render") {
            printRenderHelp();
        } else if (cmd === "tick") {
            printTickHelp();
        } else if (cmd === "step") {
            printStepHelp();
        } else if (cmd === "view") {
            printViewHelp();
        } else if (cmd === "pdf") {
            printPdfHelp();
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

    if (cmd === "render") {
        return runRender(rest);
    }

    if (cmd === "tick") {
        return runTick(rest);
    }

    if (cmd === "step") {
        return runStep(rest);
    }

    if (cmd === "view") {
        return runView(rest);
    }

    if (cmd === "pdf") {
        return runPdf(rest);
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
            "  flux render [options] <file>",
            "  flux tick [options] <file>",
            "  flux step [options] <file>",
            "  flux view <file>",
            "  flux pdf <file> --out <file.pdf>",
            "",
            "Commands:",
            "  parse   Parse Flux source files and print their IR as JSON.",
            "  check   Parse and run basic static checks.",
            "  render  Render a Flux document to canonical Render IR JSON.",
            "  tick    Advance time and render the updated document.",
            "  step    Advance docsteps and render the updated document.",
            "  view    View a Flux document in a local web preview.",
            "  pdf     Export a Flux document snapshot to PDF.",
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

function printRenderHelp(): void {
    console.log(
        [
            "Usage:",
            "  flux render [options] <file>",
            "",
            "Description:",
            "  Render a Flux document to canonical Render IR JSON.",
            "",
            "Options:",
            "  --format ir   Output format. (required; currently only 'ir')",
            "  --seed N      Deterministic RNG seed (default: 0).",
            "  --time T      Render time in seconds (default: 0).",
            "  --docstep D   Render at docstep D (default: 0).",
            "  -h, --help    Show this message.",
            "",
        ].join("\n"),
    );
}

function printTickHelp(): void {
    console.log(
        [
            "Usage:",
            "  flux tick [options] <file>",
            "",
            "Description:",
            "  Advance time by a number of seconds and render the updated IR.",
            "",
            "Options:",
            "  --seconds S  Seconds to advance time by.",
            "  --seed N     Deterministic RNG seed (default: 0).",
            "  -h, --help   Show this message.",
            "",
        ].join("\n"),
    );
}

function printStepHelp(): void {
    console.log(
        [
            "Usage:",
            "  flux step [options] <file>",
            "",
            "Description:",
            "  Advance docsteps and render the updated IR.",
            "",
            "Options:",
            "  --n N       Docsteps to advance by (default: 1).",
            "  --seed N    Deterministic RNG seed (default: 0).",
            "  -h, --help  Show this message.",
            "",
        ].join("\n"),
    );
}

function printViewHelp(): void {
    console.log(
        [
            "Usage:",
            "  flux view [options] <file>",
            "",
            "Description:",
            "  Open a local web viewer for a Flux document.",
            "",
            "Options:",
            "  --port <n>          Port for the local server (default: auto).",
            "  --docstep-ms <n>    Docstep interval in milliseconds.",
            "  --seed <n>          Seed for deterministic rendering.",
            "  --allow-net <orig>  Allow remote assets for origin (repeatable or comma-separated).",
            "  --tty              Use the legacy TTY grid viewer.",
            "  -h, --help          Show this message.",
            "",
        ].join("\n"),
    );
}

function printPdfHelp(): void {
    console.log(
        [
            "Usage:",
            "  flux pdf [options] <file> --out <file.pdf>",
            "",
            "Description:",
            "  Render a Flux document snapshot to PDF.",
            "",
            "Options:",
            "  --out <file>      Output PDF path. (required)",
            "  --seed <n>        Seed for deterministic rendering.",
            "  --docstep <n>     Docstep to render.",
            "  -h, --help        Show this message.",
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
/*                                 flux render                                */
/* -------------------------------------------------------------------------- */

async function runRender(args: string[]): Promise<ExitCode> {
    let format = "ir";
    let seed: number | undefined;
    let time: number | undefined;
    let docstep: number | undefined;
    let file: string | undefined;

    try {
        for (let i = 0; i < args.length; i += 1) {
            const arg = args[i];
            if (arg === "--format") {
                format = args[i + 1] ?? "";
                i += 1;
            } else if (arg.startsWith("--format=")) {
                format = arg.slice("--format=".length);
            } else if (arg === "--seed") {
                seed = parseNumberFlag("--seed", args[i + 1]);
                i += 1;
            } else if (arg.startsWith("--seed=")) {
                seed = parseNumberFlag("--seed", arg.slice("--seed=".length));
            } else if (arg === "--time") {
                time = parseNumberFlag("--time", args[i + 1]);
                i += 1;
            } else if (arg.startsWith("--time=")) {
                time = parseNumberFlag("--time", arg.slice("--time=".length));
            } else if (arg === "--docstep") {
                docstep = parseNumberFlag("--docstep", args[i + 1]);
                i += 1;
            } else if (arg.startsWith("--docstep=")) {
                docstep = parseNumberFlag("--docstep", arg.slice("--docstep=".length));
            } else if (!arg.startsWith("-")) {
                file = arg;
            }
        }
    } catch (error) {
        console.error(`flux render: ${(error as Error)?.message ?? error}`);
        return 1;
    }

    if (!file) {
        console.error("flux render: No input file specified.");
        printRenderHelp();
        return 1;
    }

    if (format !== "ir") {
        console.error(`flux render: Unsupported format '${format}'.`);
        return 1;
    }

    let source: string;
    try {
        source = await readSource(file);
    } catch (error) {
        console.error(formatIoError(file, error));
        return 1;
    }

    let doc: FluxDocument;
    try {
        doc = parseDocument(source);
    } catch (error) {
        console.error(formatParseOrLexerError(file, error));
        return 1;
    }

    const dir = file === "-" ? process.cwd() : path.dirname(path.resolve(file));
    const rendered = renderDocument(doc, {
        seed,
        time,
        docstep,
        assetCwd: dir,
    });

    process.stdout.write(JSON.stringify(rendered, null, 2) + "\n");
    return 0;
}

/* -------------------------------------------------------------------------- */
/*                                  flux tick                                 */
/* -------------------------------------------------------------------------- */

async function runTick(args: string[]): Promise<ExitCode> {
    let seconds: number | undefined;
    let seed: number | undefined;
    let file: string | undefined;

    try {
        for (let i = 0; i < args.length; i += 1) {
            const arg = args[i];
            if (arg === "--seconds") {
                seconds = parseNumberFlag("--seconds", args[i + 1]);
                i += 1;
            } else if (arg.startsWith("--seconds=")) {
                seconds = parseNumberFlag("--seconds", arg.slice("--seconds=".length));
            } else if (arg === "--seed") {
                seed = parseNumberFlag("--seed", args[i + 1]);
                i += 1;
            } else if (arg.startsWith("--seed=")) {
                seed = parseNumberFlag("--seed", arg.slice("--seed=".length));
            } else if (!arg.startsWith("-")) {
                file = arg;
            }
        }
    } catch (error) {
        console.error(`flux tick: ${(error as Error)?.message ?? error}`);
        return 1;
    }

    if (!file) {
        console.error("flux tick: No input file specified.");
        printTickHelp();
        return 1;
    }

    if (seconds === undefined) {
        console.error("flux tick: --seconds is required.");
        printTickHelp();
        return 1;
    }

    let source: string;
    try {
        source = await readSource(file);
    } catch (error) {
        console.error(formatIoError(file, error));
        return 1;
    }

    let doc: FluxDocument;
    try {
        doc = parseDocument(source);
    } catch (error) {
        console.error(formatParseOrLexerError(file, error));
        return 1;
    }

    const dir = file === "-" ? process.cwd() : path.dirname(path.resolve(file));
    const runtime = createDocumentRuntime(doc, { seed, assetCwd: dir });
    const rendered = runtime.tick(seconds);
    process.stdout.write(JSON.stringify(rendered, null, 2) + "\n");
    return 0;
}

/* -------------------------------------------------------------------------- */
/*                                  flux step                                 */
/* -------------------------------------------------------------------------- */

async function runStep(args: string[]): Promise<ExitCode> {
    let count: number | undefined;
    let seed: number | undefined;
    let file: string | undefined;

    try {
        for (let i = 0; i < args.length; i += 1) {
            const arg = args[i];
            if (arg === "--n") {
                count = parseNumberFlag("--n", args[i + 1]);
                i += 1;
            } else if (arg.startsWith("--n=")) {
                count = parseNumberFlag("--n", arg.slice("--n=".length));
            } else if (arg === "--seed") {
                seed = parseNumberFlag("--seed", args[i + 1]);
                i += 1;
            } else if (arg.startsWith("--seed=")) {
                seed = parseNumberFlag("--seed", arg.slice("--seed=".length));
            } else if (!arg.startsWith("-")) {
                file = arg;
            }
        }
    } catch (error) {
        console.error(`flux step: ${(error as Error)?.message ?? error}`);
        return 1;
    }

    if (!file) {
        console.error("flux step: No input file specified.");
        printStepHelp();
        return 1;
    }

    const steps = count ?? 1;

    let source: string;
    try {
        source = await readSource(file);
    } catch (error) {
        console.error(formatIoError(file, error));
        return 1;
    }

    let doc: FluxDocument;
    try {
        doc = parseDocument(source);
    } catch (error) {
        console.error(formatParseOrLexerError(file, error));
        return 1;
    }

    const dir = file === "-" ? process.cwd() : path.dirname(path.resolve(file));
    const runtime = createDocumentRuntime(doc, { seed, assetCwd: dir });
    const rendered = runtime.step(steps);
    process.stdout.write(JSON.stringify(rendered, null, 2) + "\n");
    return 0;
}

/* -------------------------------------------------------------------------- */
/*                                  flux view                                 */
/* -------------------------------------------------------------------------- */

async function runView(args: string[]): Promise<ExitCode> {
    let port: number | undefined;
    let docstepMs: number | undefined;
    let seed: number | undefined;
    let useTty = false;
    const allowNet: string[] = [];
    let file: string | undefined;

    try {
        for (let i = 0; i < args.length; i += 1) {
            const arg = args[i];
            if (arg === "--tty") {
                useTty = true;
            } else if (arg === "--port") {
                port = parseNumberFlag("--port", args[i + 1]);
                i += 1;
            } else if (arg.startsWith("--port=")) {
                port = parseNumberFlag("--port", arg.slice("--port=".length));
            } else if (arg === "--docstep-ms") {
                docstepMs = parseNumberFlag("--docstep-ms", args[i + 1]);
                i += 1;
            } else if (arg.startsWith("--docstep-ms=")) {
                docstepMs = parseNumberFlag("--docstep-ms", arg.slice("--docstep-ms=".length));
            } else if (arg === "--seed") {
                seed = parseNumberFlag("--seed", args[i + 1]);
                i += 1;
            } else if (arg.startsWith("--seed=")) {
                seed = parseNumberFlag("--seed", arg.slice("--seed=".length));
            } else if (arg === "--allow-net") {
                const raw = args[i + 1] ?? "";
                allowNet.push(...raw.split(",").map((item) => item.trim()).filter(Boolean));
                i += 1;
            } else if (arg.startsWith("--allow-net=")) {
                const raw = arg.slice("--allow-net=".length);
                allowNet.push(...raw.split(",").map((item) => item.trim()).filter(Boolean));
            } else if (!arg.startsWith("-")) {
                file = arg;
            }
        }
    } catch (error) {
        console.error(`flux view: ${(error as Error)?.message ?? error}`);
        return 1;
    }

    if (!file) {
        console.error("flux view: No input file specified.");
        printViewHelp();
        return 1;
    }
    if (file === "-") {
        console.error("flux view: stdin input is not supported for the web viewer.");
        return 1;
    }

    const docPath = path.resolve(file);

    if (useTty) {
        try {
            const source = await fs.readFile(docPath, "utf8");
            const doc = parseDocument(source);
            const runtime = createRuntime(doc, { clock: "manual" });

            const labels = new Map<string, string>();
            for (const mat of doc.materials?.materials ?? []) {
                labels.set(mat.name, mat.label ?? mat.name);
            }

            await runViewer(runtime, { docPath, title: doc.meta.title, materialLabels: labels });
            return 0;
        } catch (error) {
            console.error(`flux view: ${String((error as Error)?.message ?? error)}`);
            return 1;
        }
    }

    try {
        const server = await startViewerServer({
            docPath,
            port,
            docstepMs,
            seed,
            allowNet,
        });
        console.log(`Flux viewer running at ${server.url}`);
        console.log("Press Ctrl+C to stop.");
        openBrowser(server.url);

        await new Promise<void>((resolve) => {
            const shutdown = async () => {
                await server.close();
                resolve();
            };
            process.on("SIGINT", shutdown);
            process.on("SIGTERM", shutdown);
        });
        return 0;
    } catch (error) {
        console.error(`flux view: ${String((error as Error)?.message ?? error)}`);
        return 1;
    }
}

/* -------------------------------------------------------------------------- */
/*                                  flux pdf                                  */
/* -------------------------------------------------------------------------- */

async function runPdf(args: string[]): Promise<ExitCode> {
    let seed: number | undefined;
    let docstep: number | undefined;
    let outPath: string | undefined;
    let file: string | undefined;

    try {
        for (let i = 0; i < args.length; i += 1) {
            const arg = args[i];
            if (arg === "--out") {
                outPath = args[i + 1];
                i += 1;
            } else if (arg.startsWith("--out=")) {
                outPath = arg.slice("--out=".length);
            } else if (arg === "--seed") {
                seed = parseNumberFlag("--seed", args[i + 1]);
                i += 1;
            } else if (arg.startsWith("--seed=")) {
                seed = parseNumberFlag("--seed", arg.slice("--seed=".length));
            } else if (arg === "--docstep") {
                docstep = parseNumberFlag("--docstep", args[i + 1]);
                i += 1;
            } else if (arg.startsWith("--docstep=")) {
                docstep = parseNumberFlag("--docstep", arg.slice("--docstep=".length));
            } else if (!arg.startsWith("-")) {
                file = arg;
            }
        }
    } catch (error) {
        console.error(`flux pdf: ${(error as Error)?.message ?? error}`);
        return 1;
    }

    if (!file) {
        console.error("flux pdf: No input file specified.");
        printPdfHelp();
        return 1;
    }
    if (!outPath) {
        console.error("flux pdf: --out <file.pdf> is required.");
        printPdfHelp();
        return 1;
    }

    let source: string;
    try {
        source = await readSource(file);
    } catch (error) {
        console.error(formatIoError(file, error));
        return 1;
    }

    let doc: FluxDocument;
    try {
        doc = parseDocument(source);
    } catch (error) {
        console.error(formatParseOrLexerError(file, error));
        return 1;
    }

    const dir = file === "-" ? process.cwd() : path.dirname(path.resolve(file));
    const ir = renderDocumentIR(doc, { seed, docstep, assetCwd: dir });

    const placeholder =
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

    const assetUrl = (assetId: string): string => {
        const asset = ir.assets.find((entry) => entry.id === assetId);
        if (!asset?.path) return placeholder;
        const resolved = path.isAbsolute(asset.path) ? asset.path : path.resolve(dir, asset.path);
        return pathToFileURL(resolved).toString();
    };

    const rawUrl = (raw: string): string => {
        if (raw.startsWith("http://") || raw.startsWith("https://")) {
            return placeholder;
        }
        const resolved = path.isAbsolute(raw) ? raw : path.resolve(dir, raw);
        return pathToFileURL(resolved).toString();
    };

    const { html, css } = renderHtml(ir, { assetUrl, rawUrl });
    const typesetter = createTypesetterBackend();
    const pdf = await typesetter.pdf(html, css, { allowFile: true });
    await fs.writeFile(outPath, pdf);
    console.log(`Wrote PDF to ${outPath}`);
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

function parseNumberFlag(flag: string, raw: string | undefined): number {
    if (raw == null || raw.length === 0) {
        throw new Error(`Expected numeric value after ${flag}`);
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
        throw new Error(`Invalid number for ${flag}: '${raw}'`);
    }
    return value;
}

function openBrowser(url: string): void {
    try {
        if (process.platform === "darwin") {
            spawn("open", [url], { stdio: "ignore", detached: true });
            return;
        }
        if (process.platform === "win32") {
            spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true });
            return;
        }
        spawn("xdg-open", [url], { stdio: "ignore", detached: true });
    } catch {
        // best-effort
    }
}
