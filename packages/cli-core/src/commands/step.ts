import path from "node:path";
import { createDocumentRuntimeIR } from "@flux-lang/core";
import type { FluxDocument, RenderDocumentIR } from "@flux-lang/core";
import { errorResult, okResult, type CommandResult } from "../types.js";
import { formatIoError, formatParseOrLexerError, parseFlux, readSource } from "./common.js";

export interface StepOptions {
  file: string;
  steps?: number;
  seed?: number;
}

export interface StepData {
  rendered: RenderDocumentIR;
}

export async function stepCommand(options: StepOptions): Promise<CommandResult<StepData>> {
  if (!options.file) {
    return errorResult("flux step: No input file specified.", "NO_INPUT");
  }
  const count = options.steps ?? 1;

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
  const runtime = createDocumentRuntimeIR(doc, { seed: options.seed, assetCwd: dir });
  const rendered = runtime.step(count);
  return okResult({ rendered });
}
