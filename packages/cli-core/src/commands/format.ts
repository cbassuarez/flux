import path from "node:path";
import { errorResult, okResult, type CommandResult } from "../types.js";
import { readFileText, writeFileText } from "../fs.js";

export interface FormatOptions {
  file: string;
}

export interface FormatData {
  file: string;
}

export async function formatCommand(options: FormatOptions): Promise<CommandResult<FormatData>> {
  if (!options.file) {
    return errorResult("flux fmt: No input file specified.", "NO_INPUT");
  }
  let source: string;
  try {
    source = await readFileText(options.file);
  } catch (error) {
    return errorResult(`flux fmt: failed to read ${options.file}: ${(error as Error).message}`, "READ_ERROR", error);
  }

  const formatted = formatFluxSource(source);
  await writeFileText(path.resolve(options.file), formatted);
  return okResult({ file: options.file });
}

function formatFluxSource(source: string): string {
  const trimmed = source.replace(/[\t ]+\n/g, "\n");
  return trimmed.endsWith("\n") ? trimmed : trimmed + "\n";
}
