import path from "node:path";
import { createDocumentRuntime } from "@flux-lang/core";
import type { FluxDocument, RenderDocumentIR } from "@flux-lang/core";
import { errorResult, okResult, type CommandResult } from "../types.js";
import { formatIoError, formatParseOrLexerError, parseFlux, readSource } from "./common.js";

export interface TickOptions {
  file: string;
  seconds: number;
  seed?: number;
}

export interface TickData {
  rendered: RenderDocumentIR;
}

export async function tickCommand(options: TickOptions): Promise<CommandResult<TickData>> {
  if (!options.file) {
    return errorResult("flux tick: No input file specified.", "NO_INPUT");
  }
  if (!Number.isFinite(options.seconds)) {
    return errorResult("flux tick: --seconds is required.", "MISSING_SECONDS");
  }

  let source: string;
  try {
    source = await readSource(options.file);
  } catch (error) {
    return errorResult(formatIoError(options.file, error), "READ_ERROR", error);
  }

  let doc: FluxDocument;
  try {
    doc = parseFlux(source, options.file);
  } catch (error) {
    return errorResult(formatParseOrLexerError(options.file, error), "PARSE_ERROR", error);
  }

  const dir = options.file === "-" ? process.cwd() : path.dirname(path.resolve(options.file));
  const runtime = createDocumentRuntime(doc, { seed: options.seed, assetCwd: dir });
  const rendered = runtime.tick(options.seconds);
  return okResult({ rendered });
}
