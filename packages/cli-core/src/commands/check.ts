import { checkDocument, initRuntimeState, type FluxDocument } from "@flux-lang/core";
import { errorResult, okResult, type CommandResult } from "../types.js";
import { formatIoError, formatParseOrLexerError, parseFlux, readSource } from "./common.js";

export interface CheckOptions {
  files: string[];
  json?: boolean;
}

export interface CheckResult {
  file: string;
  ok: boolean;
  errors?: string[];
}

export interface CheckData {
  results: CheckResult[];
}

export async function checkCommand(options: CheckOptions): Promise<CommandResult<CheckData>> {
  const files = options.files ?? [];
  if (files.length === 0) {
    return errorResult("flux check: No input files specified.", "NO_INPUT");
  }

  const results: CheckResult[] = [];

  for (const file of files) {
    let source: string;
    try {
      source = await readSource(file);
    } catch (error) {
      results.push({ file, ok: false, errors: [formatIoError(file, error)] });
      continue;
    }

    let doc: FluxDocument;
    try {
      doc = parseFlux(source, file);
    } catch (error) {
      results.push({ file, ok: false, errors: [formatParseOrLexerError(file, error)] });
      continue;
    }

    const errors: string[] = [];
    try {
      initRuntimeState(doc);
    } catch (error) {
      const detail = (error as Error)?.message ?? String(error);
      errors.push(`${file}:0:0: Check error: initRuntimeState failed: ${detail}`);
    }
    errors.push(...checkDocument(file, doc));

    results.push({ file, ok: errors.length === 0, errors: errors.length ? errors : undefined });
  }

  return okResult({ results });
}
