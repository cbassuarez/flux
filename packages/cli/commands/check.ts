// packages/cli/src/commands/check.ts
import { parseArgs } from "packages/cli/src/args.js";
import { collectFluxFiles, readFileText } from "packages/cli/src/fs-utils.js";
import { parseDocument } from "@flux-lang/core"; // adjust path if needed

interface CheckOptions {
  quiet: boolean;
  json: boolean;
  maxErrors?: number;
  recursive: boolean;
  stdin: boolean;
}

type Severity = "error" | "warning";

interface Diagnostic {
  file: string;
  line?: number;
  column?: number;
  severity: Severity;
  code: string;
  message: string;
}

export async function runCheckCommand(argv: string[]): Promise<void> {
  const { flags, positional } = parseArgs(argv);

  const options: CheckOptions = {
    quiet: Boolean(flags.q || flags.quiet),
    json: Boolean(flags.json),
    maxErrors: typeof flags["max-errors"] === "number" ? (flags["max-errors"] as number) : undefined,
    recursive: !Boolean(flags["no-recursive"]),
    stdin: Boolean(flags.stdin),
  };

  const diags: Diagnostic[] = [];

  if (options.stdin) {
    const src = await readAllStdin();
    collectDiagnostics("<stdin>", src, diags, options);
  } else {
    const roots = positional.length > 0 ? positional : ["."];
    for (const root of roots) {
      const files = collectFluxFiles(root, options.recursive);
      for (const file of files) {
        const src = readFileText(file);
        collectDiagnostics(file, src, diags, options);
        if (options.maxErrors && diags.length >= options.maxErrors) {
          break;
        }
      }
      if (options.maxErrors && diags.length >= options.maxErrors) {
        break;
      }
    }
  }

  if (options.json) {
    process.stdout.write(JSON.stringify(diags, null, 2) + "\n");
  } else if (!options.quiet) {
    for (const d of diags) {
      const loc =
        d.line != null && d.column != null ? `${d.file}:${d.line}:${d.column}` : d.file;
      console.error(`${loc} [${d.severity.toUpperCase()} ${d.code}] ${d.message}`);
    }

    if (diags.length === 0) {
      console.log("flux check: no issues found.");
    }
  }

  if (diags.some((d) => d.severity === "error")) {
    process.exitCode = 1;
  }
}

async function readAllStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", (err) => reject(err));
  });
}

function collectDiagnostics(
  file: string,
  src: string,
  diags: Diagnostic[],
  opts: CheckOptions,
): void {
  try {
    const doc = parseDocument(src);

    // Minimal static checks, "as robust as possible for this spec" without overreaching.

    // 1. meta.version should be "0.1.0"
    if (!doc.meta?.version) {
      diags.push({
        file,
        severity: "warning",
        code: "W_META_VERSION_MISSING",
        message: "meta.version is missing; expected '0.1.0' for v0.1 documents.",
      });
    } else if (doc.meta.version !== "0.1.0") {
      diags.push({
        file,
        severity: "warning",
        code: "W_META_VERSION_MISMATCH",
        message: `meta.version is '${doc.meta.version}', expected '0.1.0' for v0.1 documents.`,
      });
    }

    // 2. docstep rules should have a docstep param if you want to enforce that.
    const hasDocstepParam =
      doc.state.params?.some((p) => p.name === "docstep" && p.type === "int") ?? false;
    const hasDocstepRules = doc.rules?.some((r) => r.mode === "docstep") ?? false;

    if (hasDocstepRules && !hasDocstepParam) {
      diags.push({
        file,
        severity: "warning",
        code: "W_DOCSTEP_PARAM_MISSING",
        message:
          "Document defines docstep rules but no 'docstep : int [...]' param was found in state.",
      });
    }

    // (Many of the other invariants are already enforced at parse-time.)
  } catch (err) {
    const e = err as Error;
    const { line, column } = extractLocationFromMessage(e.message);

    diags.push({
      file,
      line,
      column,
      severity: "error",
      code: "E_PARSE",
      message: e.message,
    });
  }
}

function extractLocationFromMessage(message: string): { line?: number; column?: number } {
  // Parser error format:
  //   "Parse error at 33:40 near '{': Expected expression"
  const match = /at\s+(\d+):(\d+)/.exec(message);
  if (!match) return {};
  return {
    line: Number(match[1]),
    column: Number(match[2]),
  };
}

