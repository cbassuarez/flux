#!/usr/bin/env node

import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import {
  parseCommand,
  checkCommand,
  renderCommand,
  tickCommand,
  stepCommand,
  viewCommand,
  pdfCommand,
  configCommand,
  newCommand,
  addCommand,
  updateRecents,
  resolveConfig,
  formatCommand,
} from "@flux-lang/cli-core";
import type { FluxConfig } from "@flux-lang/cli-core";
import { runViewer } from "../view/runViewer.js";
import { createRuntime, parseDocument, type FluxDocument } from "@flux-lang/core";
import { shouldLaunchUi } from "../ui-routing.js";

const VERSION = "0.3.0";

type ExitCode = 0 | 1 | 2;

void (async () => {
  try {
    const code = await main(process.argv.slice(2));
    if (code !== 0) process.exit(code);
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error);
    console.error(`Internal error: ${msg}`);
    process.exit(2);
  }
})();

async function main(argv: string[]): Promise<ExitCode> {
  const parsed = parseGlobalArgs(argv);
  const args = parsed.args;

  const uiEnabled = shouldLaunchUi({
    stdoutIsTTY: Boolean(process.stdout.isTTY),
    stdinIsTTY: process.stdin.isTTY,
    json: parsed.json,
    noUi: parsed.noUi,
    env: process.env,
  });

  if (uiEnabled) {
    return launchUi({
      cwd: process.cwd(),
      initialArgs: args,
      detach: parsed.detach,
      helpCommand: parsed.help ? args[0] : undefined,
      version: parsed.version ? `flux v${VERSION}` : undefined,
    });
  }

  if (parsed.version) {
    console.log(`flux v${VERSION}`);
    return 0;
  }

  if (parsed.help) {
    if (args.length === 0) {
      printGlobalHelp();
      return 0;
    }
    printCommandHelp(args[0]);
    return 0;
  }

  if (args.length === 0) {
    printGlobalHelp();
    return 0;
  }

  const [cmd, ...rest] = args;

  switch (cmd) {
    case "parse":
      return runParse(rest);
    case "check":
      return runCheck(rest, parsed);
    case "render":
      return runRender(rest);
    case "fmt":
      return runFormat(rest, parsed);
    case "tick":
      return runTick(rest);
    case "step":
      return runStep(rest);
    case "view":
      return runView(rest, parsed);
    case "edit":
      return runEdit(rest, parsed);
    case "pdf":
      return runPdf(rest, parsed);
    case "config":
      return runConfig(rest, parsed);
    case "new":
      return runNew(rest, parsed);
    case "add":
      return runAdd(rest, parsed);
    default:
      console.error(`Unknown command '${cmd}'.`);
      printGlobalHelp();
      return 1;
  }
}

function isInteractive(): boolean {
  return Boolean(process.stdout.isTTY && process.stdin.isTTY);
}

function parseGlobalArgs(argv: string[]) {
  const flags = {
    help: false,
    version: false,
    noUi: false,
    ui: false,
    detach: false,
    json: false,
    quiet: false,
    verbose: false,
  };
  const args: string[] = [];
  let passthrough = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") {
      passthrough = true;
      continue;
    }
    if (!passthrough) {
      if (arg === "-h" || arg === "--help") {
        flags.help = true;
        continue;
      }
      if (arg === "-v" || arg === "--version") {
        flags.version = true;
        continue;
      }
      if (arg === "--no-ui") {
        flags.noUi = true;
        continue;
      }
      if (arg === "--ui") {
        flags.ui = true;
        continue;
      }
      if (arg === "--detach") {
        flags.detach = true;
        continue;
      }
      if (arg === "--json") {
        flags.json = true;
        continue;
      }
      if (arg === "--quiet" || arg === "-q") {
        flags.quiet = true;
        continue;
      }
      if (arg === "--verbose" || arg === "-V") {
        flags.verbose = true;
        continue;
      }
    }
    args.push(arg);
  }
  return { ...flags, args };
}

function printCommandHelp(cmd: string): void {
  if (cmd === "parse") return printParseHelp();
  if (cmd === "check") return printCheckHelp();
  if (cmd === "render") return printRenderHelp();
  if (cmd === "fmt") return printFormatHelp();
  if (cmd === "tick") return printTickHelp();
  if (cmd === "step") return printStepHelp();
  if (cmd === "view") return printViewHelp();
  if (cmd === "edit") return printEditHelp();
  if (cmd === "pdf") return printPdfHelp();
  if (cmd === "config") return printConfigHelp();
  if (cmd === "new") return printNewHelp();
  if (cmd === "add") return printAddHelp();
  return printGlobalHelp();
}

function printGlobalHelp(): void {
  console.log(
    [
      `Flux CLI v${VERSION}`,
      "",
      "Usage:",
      "  flux                (launch UI in TTY)",
      "  flux parse [options] <files...>",
      "  flux check [options] <files...>",
      "  flux render [options] <file>",
      "  flux fmt <file>",
      "  flux tick [options] <file>",
      "  flux step [options] <file>",
      "  flux view <file>",
      "  flux edit <file>",
      "  flux pdf <file> --out <file.pdf>",
      "  flux config [set <key> <value>]",
      "  flux new <template> [options]",
      "  flux add <kind> [options]",
      "",
      "Commands:",
      "  parse   Parse Flux source files and print their IR as JSON.",
      "  check   Parse and run basic static checks.",
      "  render  Render a Flux document to canonical Render IR JSON.",
      "  fmt     Format a Flux document in-place.",
      "  tick    Advance time and render the updated document.",
      "  step    Advance docsteps and render the updated document.",
      "  view    View a Flux document in a local web preview.",
      "  edit    Edit a Flux document in the local web editor.",
      "  pdf     Export a Flux document snapshot to PDF.",
      "  config  View or edit configuration.",
      "  new     Create a new Flux document.",
      "  add     Apply structured edits to a Flux document.",
      "",
      "Global options:",
      "  -h, --help      Show this help message.",
      "  -v, --version   Show CLI version.",
      "  --no-ui         Disable Ink UI launch.",
      "  --ui            Force Ink UI launch (TTY only).",
      "  --detach        Keep viewer running on UI exit.",
      "  --json          Emit machine-readable JSON where applicable.",
      "  -q, --quiet     Reduce non-essential output.",
      "  -V, --verbose   Show verbose logs.",
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

function printFormatHelp(): void {
  console.log(
    [
      "Usage:",
      "  flux fmt <file>",
      "",
      "Description:",
      "  Apply a minimal formatter to a Flux document.",
      "",
      "Options:",
      "  -h, --help  Show this message.",
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
      "  --time-rate <n>     Time multiplier for viewer ticks (default: 1).",
      "  --seed <n>          Seed for deterministic rendering.",
      "  --allow-net <orig>  Allow remote assets for origin (repeatable or comma-separated).",
      "  --editor-dist <p>   Serve editor assets from this dist folder.",
      "  --no-time           Disable automatic time advancement.",
      "  --tty               Use the legacy TTY grid viewer.",
      "  -h, --help          Show this message.",
      "",
    ].join("\n"),
  );
}

function printEditHelp(): void {
  console.log(
    [
      "Usage:",
      "  flux edit [options] <file>",
      "",
      "Description:",
      "  Open the local web editor for a Flux document.",
      "",
      "Options:",
      "  --port <n>          Port for the local server (default: auto).",
      "  --docstep-ms <n>    Docstep interval in milliseconds.",
      "  --time-rate <n>     Time multiplier for viewer ticks (default: 1).",
      "  --seed <n>          Seed for deterministic rendering.",
      "  --allow-net <orig>  Allow remote assets for origin (repeatable or comma-separated).",
      "  --editor-dist <p>   Serve editor assets from this dist folder.",
      "  --no-time           Disable automatic time advancement.",
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

function printConfigHelp(): void {
  console.log(
    [
      "Usage:",
      "  flux config",
      "  flux config set <key> <value> [--init]",
      "",
      "Options:",
      "  --json      Emit JSON.",
      "  --init      Create flux.config.json if missing.",
      "",
    ].join("\n"),
  );
}

function printNewHelp(): void {
  console.log(
    [
      "Usage:",
      "  flux new           (launch wizard)",
      "  flux new <template> --out <dir> --page Letter|A4 --theme print|screen|both --fonts tech|bookish",
      "    --fallback system|none --assets yes|no --chapters N --live yes|no",
      "",
      "Templates:",
      "  demo, article, spec, zine, paper, blank",
      "",
    ].join("\n"),
  );
}

function printAddHelp(): void {
  console.log(
    [
      "Usage:",
      "  flux add <kind> [options] <file>",
      "",
      "Kinds:",
      "  title, page, section, figure, callout, table, slot, inline-slot, bibliography-stub",
      "",
      "Options:",
      "  --text <value>       Text value for title/callout.",
      "  --heading <value>    Heading text for sections.",
      "  --label <value>      Optional label for figure/callout.",
      "  --no-heading         Omit section heading.",
      "  --no-check           Skip check after editing.",
      "",
    ].join("\n"),
  );
}

async function runParse(args: string[]): Promise<ExitCode> {
  const opts = { ndjson: false, pretty: false, compact: false, files: [] as string[] };
  for (const arg of args) {
    if (arg === "--ndjson") opts.ndjson = true;
    else if (arg === "--pretty") opts.pretty = true;
    else if (arg === "--compact") opts.compact = true;
    else opts.files.push(arg);
  }

  const result = await parseCommand(opts);
  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "flux parse failed");
    if (result.error?.code === "NO_INPUT") printParseHelp();
    return 1;
  }

  if (result.data.ndjson) {
    for (const item of result.data.docs) {
      process.stdout.write(JSON.stringify({ file: item.file, doc: item.doc }) + "\n");
    }
    return 0;
  }

  const doc = result.data.docs[0].doc;
  const space = result.data.compact ? 0 : 2;
  process.stdout.write(JSON.stringify(doc, null, space) + "\n");
  return 0;
}

async function runCheck(args: string[], globals: ReturnType<typeof parseGlobalArgs>): Promise<ExitCode> {
  const files = args.filter((arg) => !arg.startsWith("-"));
  const result = await checkCommand({ files, json: globals.json });
  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "flux check failed");
    printCheckHelp();
    return 1;
  }

  const results = result.data.results;
  const failed = results.filter((r) => !r.ok);

  if (globals.json) {
    for (const r of results) {
      const payload: { file: string; ok: boolean; errors?: { message: string }[] } = {
        file: r.file,
        ok: r.ok,
      };
      if (r.errors) payload.errors = r.errors.map((message) => ({ message }));
      process.stdout.write(JSON.stringify(payload) + "\n");
    }
    return failed.length ? 1 : 0;
  }

  for (const r of results) {
    if (!r.errors) continue;
    for (const msg of r.errors) console.error(msg);
  }

  if (failed.length) {
    if (!globals.quiet) console.log(`✗ ${failed.length} of ${results.length} files failed checks`);
    return 1;
  }

  if (!globals.quiet) console.log(`✓ ${results.length} files OK`);
  return 0;
}

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

  const result = await renderCommand({ file, format: format as "ir", seed, time, docstep });
  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "flux render failed");
    return 1;
  }
  process.stdout.write(JSON.stringify(result.data.rendered, null, 2) + "\n");
  return 0;
}

async function runFormat(args: string[], globals: ReturnType<typeof parseGlobalArgs>): Promise<ExitCode> {
  const file = args.find((arg) => !arg.startsWith("-"));
  if (!file) {
    console.error("flux fmt: No input file specified.");
    printFormatHelp();
    return 1;
  }
  const result = await formatCommand({ file });
  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "flux fmt failed");
    return 1;
  }
  if (globals.json) {
    process.stdout.write(JSON.stringify(result.data) + "\n");
  } else if (!globals.quiet) {
    console.log(`Formatted ${file}`);
  }
  return 0;
}

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

  const result = await tickCommand({ file, seconds, seed });
  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "flux tick failed");
    return 1;
  }
  process.stdout.write(JSON.stringify(result.data.rendered, null, 2) + "\n");
  return 0;
}

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

  const result = await stepCommand({ file, steps: count, seed });
  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "flux step failed");
    return 1;
  }
  process.stdout.write(JSON.stringify(result.data.rendered, null, 2) + "\n");
  return 0;
}

async function runView(args: string[], globals: ReturnType<typeof parseGlobalArgs>): Promise<ExitCode> {
  let port: number | undefined;
  let docstepMs: number | undefined;
  let timeRate: number | undefined;
  let seed: number | undefined;
  let useTty = false;
  let editorDist: string | undefined;
  const allowNet: string[] = [];
  let file: string | undefined;
  let advanceTime = true;
  let advanceTimeExplicit = false;

  try {
    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      if (arg === "--tty") {
        useTty = true;
      } else if (arg === "--no-time") {
        advanceTime = false;
        advanceTimeExplicit = true;
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
      } else if (arg === "--time-rate") {
        timeRate = parseNumberFlag("--time-rate", args[i + 1]);
        i += 1;
      } else if (arg.startsWith("--time-rate=")) {
        timeRate = parseNumberFlag("--time-rate", arg.slice("--time-rate=".length));
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
      } else if (arg === "--editor-dist") {
        editorDist = args[i + 1];
        i += 1;
      } else if (arg.startsWith("--editor-dist=")) {
        editorDist = arg.slice("--editor-dist=".length);
      } else if (!arg.startsWith("-")) {
        file = arg;
      }
    }
  } catch (error) {
    console.error(`flux view: ${(error as Error)?.message ?? error}`);
    return 1;
  }

  const resolved = await resolveConfig({ cwd: process.cwd(), env: process.env });
  if (docstepMs === undefined) {
    docstepMs = resolved.config.docstepMs;
  }
  if (!advanceTimeExplicit) {
    advanceTime = resolved.config.advanceTime;
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

  if (useTty) {
    try {
      const source = await fs.readFile(file, "utf8");
      const doc = parseFlux(source, file);
      const runtime = createRuntime(doc, { clock: "manual" });
      await runViewer(runtime, { docPath: file, title: doc.meta.title, materialLabels: new Map() });
      return 0;
    } catch (error) {
      console.error(`flux view: ${String((error as Error)?.message ?? error)}`);
      return 1;
    }
  }

  const result = await viewCommand({
    cwd: process.cwd(),
    docPath: file,
    port,
    docstepMs,
    seed,
    allowNet,
    advanceTime,
    timeRate,
    editorDist,
  });

  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "flux view failed");
    return 1;
  }

  await updateRecents(process.cwd(), path.resolve(file));

  const session = result.data.session;
  if (globals.json) {
    process.stdout.write(JSON.stringify(session) + "\n");
  } else if (!globals.quiet) {
    console.log(`Flux viewer running at ${session.url}`);
    if (session.attached) {
      console.log("Attached to existing viewer.");
    }
    console.log("Press Ctrl+C to stop.");
  }

  if (!globals.quiet) {
    openBrowser(session.url);
  }

  if (session.close) {
    await new Promise<void>((resolve) => {
      const shutdown = async () => {
        await session.close?.();
        resolve();
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    });
  }

  return 0;
}

async function runEdit(args: string[], globals: ReturnType<typeof parseGlobalArgs>): Promise<ExitCode> {
  let port: number | undefined;
  let docstepMs: number | undefined;
  let timeRate: number | undefined;
  let seed: number | undefined;
  let editorDist: string | undefined;
  const allowNet: string[] = [];
  let file: string | undefined;
  let advanceTime = true;
  let advanceTimeExplicit = false;

  try {
    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      if (arg === "--no-time") {
        advanceTime = false;
        advanceTimeExplicit = true;
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
      } else if (arg === "--time-rate") {
        timeRate = parseNumberFlag("--time-rate", args[i + 1]);
        i += 1;
      } else if (arg.startsWith("--time-rate=")) {
        timeRate = parseNumberFlag("--time-rate", arg.slice("--time-rate=".length));
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
      } else if (arg === "--editor-dist") {
        editorDist = args[i + 1];
        i += 1;
      } else if (arg.startsWith("--editor-dist=")) {
        editorDist = arg.slice("--editor-dist=".length);
      } else if (!arg.startsWith("-")) {
        file = arg;
      }
    }
  } catch (error) {
    console.error(`flux edit: ${(error as Error)?.message ?? error}`);
    return 1;
  }

  const resolved = await resolveConfig({ cwd: process.cwd(), env: process.env });
  if (docstepMs === undefined) {
    docstepMs = resolved.config.docstepMs;
  }
  if (!advanceTimeExplicit) {
    advanceTime = resolved.config.advanceTime;
  }

  if (!file) {
    console.error("flux edit: No input file specified.");
    printEditHelp();
    return 1;
  }
  if (file === "-") {
    console.error("flux edit: stdin input is not supported for the web editor.");
    return 1;
  }

  const result = await viewCommand({
    cwd: process.cwd(),
    docPath: file,
    port,
    docstepMs,
    seed,
    allowNet,
    advanceTime,
    timeRate,
    editorDist,
  });

  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "flux edit failed");
    return 1;
  }

  await updateRecents(process.cwd(), path.resolve(file));

  const session = result.data.session;
  const absolutePath = path.resolve(file);
  const editorUrl = `${session.url}/edit?file=${encodeURIComponent(absolutePath)}`;

  if (globals.json) {
    process.stdout.write(JSON.stringify({ ...session, editorUrl }) + "\n");
  } else if (!globals.quiet) {
    console.log(`Flux editor running at ${editorUrl}`);
    if (session.attached) {
      console.log("Attached to existing editor.");
    }
    console.log("Press Ctrl+C to stop.");
  }

  if (!globals.quiet) {
    openBrowser(editorUrl);
  }

  if (session.close) {
    await new Promise<void>((resolve) => {
      const shutdown = async () => {
        await session.close?.();
        resolve();
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    });
  }

  return 0;
}

async function runPdf(args: string[], globals: ReturnType<typeof parseGlobalArgs>): Promise<ExitCode> {
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

  if (!file || !outPath) {
    console.error("flux pdf: --out <file.pdf> is required.");
    printPdfHelp();
    return 1;
  }

  const result = await pdfCommand({ file, outPath, seed, docstep });
  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "flux pdf failed");
    return 1;
  }

  if (globals.json) {
    process.stdout.write(JSON.stringify(result.data) + "\n");
  } else if (!globals.quiet) {
    console.log(`Wrote PDF to ${outPath}`);
  }

  return 0;
}

async function runConfig(args: string[], globals: ReturnType<typeof parseGlobalArgs>): Promise<ExitCode> {
  if (args.length === 0) {
    const result = await configCommand({
      cwd: process.cwd(),
      action: "view",
      env: process.env,
    });
    if (!result.ok || !result.data) {
      console.error(result.error?.message ?? "flux config failed");
      return 1;
    }
    return printConfig(result.data.config, globals);
  }

  if (args[0] === "set") {
    const key = args[1];
    const value = args[2];
    const init = args.includes("--init");
    if (!key || value === undefined) {
      printConfigHelp();
      return 1;
    }
    const parsedValue = parseConfigValue(key, value);
    const result = await configCommand({
      cwd: process.cwd(),
      action: "set",
      key: parsedValue.key,
      value: parsedValue.value,
      init,
      env: process.env,
    });
    if (!result.ok || !result.data) {
      console.error(result.error?.message ?? "flux config set failed");
      return 1;
    }
    return printConfig(result.data.config, globals);
  }

  printConfigHelp();
  return 1;
}

async function runNew(args: string[], globals: ReturnType<typeof parseGlobalArgs>): Promise<ExitCode> {
  const [template, ...rest] = args;
  if (!template) {
    printNewHelp();
    return 1;
  }

  const opts = parseNewArgs(rest);
  if (!opts.out) {
    const resolved = await resolveConfig({ cwd: process.cwd(), env: process.env });
    if (resolved.config.defaultOutputDir && resolved.config.defaultOutputDir !== ".") {
      opts.out = resolved.config.defaultOutputDir;
    }
  }
  const result = await newCommand({
    cwd: process.cwd(),
    template: template as any,
    out: opts.out,
    page: opts.page,
    theme: opts.theme,
    fonts: opts.fonts,
    fontFallback: opts.fontFallback,
    assets: opts.assets,
    chapters: opts.chapters,
    live: opts.live,
  });

  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "flux new failed");
    return 1;
  }

  await updateRecents(process.cwd(), result.data.docPath);

  if (globals.json) {
    process.stdout.write(JSON.stringify(result.data) + "\n");
  } else if (!globals.quiet) {
    console.log(`Created ${result.data.docPath}`);
    printNewNextSteps(result.data.docPath);
  }

  return 0;
}

async function runAdd(args: string[], globals: ReturnType<typeof parseGlobalArgs>): Promise<ExitCode> {
  const [kind, ...rest] = args;
  if (!kind) {
    printAddHelp();
    return 1;
  }

  const parsed = parseAddArgs(rest);
  if (!parsed.file) {
    console.error("flux add: missing <file>");
    printAddHelp();
    return 1;
  }

  const result = await addCommand({
    cwd: process.cwd(),
    file: parsed.file,
    kind: kind as any,
    text: parsed.text,
    heading: parsed.heading,
    label: parsed.label,
    noHeading: parsed.noHeading,
    noCheck: parsed.noCheck,
  });

  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "flux add failed");
    return 1;
  }

  if (globals.json) {
    process.stdout.write(JSON.stringify(result.data) + "\n");
  } else if (!globals.quiet) {
    console.log(`Updated ${result.data.file}`);
  }

  return 0;
}

function parseNewArgs(args: string[]) {
  const opts: {
    out?: string;
    page?: "Letter" | "A4";
    theme?: "print" | "screen" | "both";
    fonts?: "tech" | "bookish";
    fontFallback?: "system" | "none";
    assets?: boolean;
    chapters?: number;
    live?: boolean;
  } = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--out") {
      opts.out = args[i + 1];
      i += 1;
    } else if (arg.startsWith("--out=")) {
      opts.out = arg.slice("--out=".length);
    } else if (arg === "--page") {
      opts.page = args[i + 1] as any;
      i += 1;
    } else if (arg.startsWith("--page=")) {
      opts.page = arg.slice("--page=".length) as any;
    } else if (arg === "--theme") {
      opts.theme = args[i + 1] as any;
      i += 1;
    } else if (arg.startsWith("--theme=")) {
      opts.theme = arg.slice("--theme=".length) as any;
    } else if (arg === "--fonts") {
      opts.fonts = args[i + 1] as any;
      i += 1;
    } else if (arg.startsWith("--fonts=")) {
      opts.fonts = arg.slice("--fonts=".length) as any;
    } else if (arg === "--fallback" || arg === "--font-fallback") {
      opts.fontFallback = parseFontFallback(args[i + 1]);
      i += 1;
    } else if (arg.startsWith("--fallback=")) {
      opts.fontFallback = parseFontFallback(arg.slice("--fallback=".length));
    } else if (arg.startsWith("--font-fallback=")) {
      opts.fontFallback = parseFontFallback(arg.slice("--font-fallback=".length));
    } else if (arg === "--assets") {
      opts.assets = parseYesNo(args[i + 1]);
      i += 1;
    } else if (arg.startsWith("--assets=")) {
      opts.assets = parseYesNo(arg.slice("--assets=".length));
    } else if (arg === "--chapters") {
      opts.chapters = parseNumberFlag("--chapters", args[i + 1]);
      i += 1;
    } else if (arg.startsWith("--chapters=")) {
      opts.chapters = parseNumberFlag("--chapters", arg.slice("--chapters=".length));
    } else if (arg === "--live") {
      opts.live = parseYesNo(args[i + 1]);
      i += 1;
    } else if (arg.startsWith("--live=")) {
      opts.live = parseYesNo(arg.slice("--live=".length));
    }
  }
  return opts;
}

function parseAddArgs(args: string[]) {
  const opts: { file?: string; text?: string; heading?: string; label?: string; noHeading?: boolean; noCheck?: boolean } = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--text") {
      opts.text = args[i + 1];
      i += 1;
    } else if (arg.startsWith("--text=")) {
      opts.text = arg.slice("--text=".length);
    } else if (arg === "--heading") {
      opts.heading = args[i + 1];
      i += 1;
    } else if (arg.startsWith("--heading=")) {
      opts.heading = arg.slice("--heading=".length);
    } else if (arg === "--label") {
      opts.label = args[i + 1];
      i += 1;
    } else if (arg.startsWith("--label=")) {
      opts.label = arg.slice("--label=".length);
    } else if (arg === "--no-heading") {
      opts.noHeading = true;
    } else if (arg === "--no-check") {
      opts.noCheck = true;
    } else if (!arg.startsWith("-")) {
      opts.file = arg;
    }
  }
  return opts;
}

function parseYesNo(raw?: string): boolean {
  if (!raw) return true;
  return !(raw === "no" || raw === "false" || raw === "0");
}

function parseFontFallback(raw?: string): "system" | "none" {
  if (!raw) return "system";
  if (raw === "none" || raw === "off" || raw === "false" || raw === "0") return "none";
  return "system";
}

function parseConfigValue(key: string, raw: string): { key: keyof FluxConfig; value: FluxConfig[keyof FluxConfig] } {
  switch (key) {
    case "docstepMs":
    case "docstep-ms":
      return { key: "docstepMs", value: Number(raw) };
    case "advanceTime":
    case "advance-time":
      return { key: "advanceTime", value: raw !== "0" && raw !== "false" };
    case "defaultPageSize":
    case "page":
      return { key: "defaultPageSize", value: (raw === "A4" ? "A4" : "Letter") as any };
    case "defaultTheme":
    case "theme":
      return { key: "defaultTheme", value: raw as any };
    case "defaultFonts":
    case "fonts":
      return { key: "defaultFonts", value: raw as any };
    case "defaultOutputDir":
    case "output":
      return { key: "defaultOutputDir", value: raw };
    default:
      return { key: key as keyof FluxConfig, value: raw as any };
  }
}

async function printConfig(config: FluxConfig, globals: ReturnType<typeof parseGlobalArgs>): Promise<ExitCode> {
  if (globals.json) {
    process.stdout.write(JSON.stringify(config, null, 2) + "\n");
    return 0;
  }
  if (!globals.quiet) {
    console.log(JSON.stringify(config, null, 2));
  }
  return 0;
}

function printNewNextSteps(docPath: string): void {
  const pdfPath = docPath.replace(/\.flux$/i, ".pdf");
  console.log(
    [
      "",
      "Next steps:",
      `  flux view ${docPath}`,
      `  flux check ${docPath}`,
      `  flux pdf ${docPath} --out ${pdfPath}`,
      "",
    ].join("\n"),
  );
}

function parseNumberFlag(flag: string, raw: string | undefined): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${flag} expects a finite number`);
  }
  return value;
}

function openBrowser(url: string): void {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";

  const args =
    process.platform === "win32" ? ["/c", "start", url.replace(/&/g, "^&")] : [url];

  spawn(command, args, { stdio: "ignore", detached: true });
}

async function launchUi(options: {
  cwd: string;
  mode?: "new";
  initialArgs?: string[];
  detach?: boolean;
  helpCommand?: string;
  version?: string;
}): Promise<ExitCode> {
  const { runCliUi } = await import("@flux-lang/cli-ui");
  await runCliUi({
    cwd: options.cwd,
    mode: options.mode,
    initialArgs: options.initialArgs,
    detach: options.detach,
    helpCommand: options.helpCommand,
    version: options.version,
  });
  return 0;
}

function parseFlux(source: string, filePath: string | null): FluxDocument {
  if (!filePath || filePath === "-") {
    return parseDocument(source);
  }
  const resolved = path.resolve(filePath);
  return parseDocument(source, {
    sourcePath: resolved,
    docRoot: path.dirname(resolved),
    resolveIncludes: true,
  });
}
