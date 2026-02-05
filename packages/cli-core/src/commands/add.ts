import path from "node:path";
import { applyAddTransform, formatFluxSource } from "@flux-lang/core";
import type { FluxDocument } from "@flux-lang/core";
import { errorResult, okResult, type CommandResult } from "../types.js";
import { readFileText, writeFileText } from "../fs.js";
import { parseFlux } from "./common.js";
import { checkCommand } from "./check.js";

export type AddKind =
  | "title"
  | "page"
  | "section"
  | "figure"
  | "callout"
  | "table"
  | "slot"
  | "inline-slot"
  | "bibliography-stub";

export interface AddOptions {
  cwd: string;
  file: string;
  kind: AddKind;
  text?: string;
  heading?: string;
  label?: string;
  noHeading?: boolean;
  noCheck?: boolean;
}

export interface AddData {
  file: string;
  kind: AddKind;
}

export async function addCommand(options: AddOptions): Promise<CommandResult<AddData>> {
  if (!options.file) {
    return errorResult("flux add: No input file specified.", "NO_INPUT");
  }

  let source: string;
  try {
    source = await readFileText(options.file);
  } catch (error) {
    return errorResult(`flux add: failed to read ${options.file}: ${(error as Error).message}`, "READ_ERROR", error);
  }

  let doc: FluxDocument;
  try {
    doc = parseFlux(source, options.file);
  } catch (error) {
    return errorResult(`flux add: parse failed: ${(error as Error).message}`, "PARSE_ERROR", error);
  }

  let nextSource = source;
  try {
    nextSource = applyAddTransform(source, doc, {
      kind: options.kind,
      text: options.text,
      heading: options.heading,
      label: options.label,
      noHeading: options.noHeading,
    });
  } catch (error) {
    return errorResult(`flux add: ${String((error as Error)?.message ?? error)}`, "ADD_FAILED", error);
  }

  nextSource = formatFluxSource(nextSource);
  await writeFileText(path.resolve(options.file), nextSource);

  if (!options.noCheck) {
    const check = await checkCommand({ files: [options.file] });
    const failures = check.data?.results?.filter((r) => !r.ok) ?? [];
    if (failures.length > 0) {
      return errorResult("flux add: check failed after edit", "CHECK_FAILED", failures);
    }
  }

  return okResult({ file: options.file, kind: options.kind });
}
