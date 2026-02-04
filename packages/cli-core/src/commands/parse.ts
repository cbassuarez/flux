import type { FluxDocument } from "@flux-lang/core";
import { errorResult, okResult, type CommandResult } from "../types.js";
import { formatIoError, formatParseOrLexerError, parseFlux, readSource } from "./common.js";

export interface ParseOptions {
  files: string[];
  ndjson?: boolean;
  pretty?: boolean;
  compact?: boolean;
}

export interface ParsedDoc {
  file: string;
  doc: FluxDocument;
}

export interface ParseData {
  docs: ParsedDoc[];
  ndjson: boolean;
  pretty: boolean;
  compact: boolean;
}

export async function parseCommand(options: ParseOptions): Promise<CommandResult<ParseData>> {
  const files = options.files ?? [];
  if (files.length === 0) {
    return errorResult("flux parse: No input files specified.", "NO_INPUT");
  }
  const usesStdin = files.includes("-");
  if (usesStdin && files.length > 1) {
    return errorResult("flux parse: '-' (stdin) can only be used with a single input.", "STDIN_MULTI");
  }
  if (options.pretty && options.compact && !options.ndjson) {
    return errorResult("flux parse: --pretty and --compact are mutually exclusive.", "INVALID_FLAGS");
  }

  const docs: ParsedDoc[] = [];
  for (const file of files) {
    let source: string;
    try {
      source = await readSource(file);
    } catch (error) {
      return errorResult(formatIoError(file, error), "READ_ERROR", error);
    }
    try {
      const doc = parseFlux(source, file);
      docs.push({ file: file === "-" ? "<stdin>" : file, doc });
    } catch (error) {
      return errorResult(formatParseOrLexerError(file, error), "PARSE_ERROR", error);
    }
  }

  const ndjson = options.ndjson ?? docs.length > 1;
  const pretty = options.pretty ?? (docs.length === 1 && !options.compact);
  const compact = options.compact ?? false;
  return okResult({ docs, ndjson, pretty, compact });
}
