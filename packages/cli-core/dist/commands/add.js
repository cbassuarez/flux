import path from "node:path";
import { applyAddTransform, formatFluxSource } from "@flux-lang/core";
import { errorResult, okResult } from "../types.js";
import { readFileText, writeFileText } from "../fs.js";
import { parseFlux } from "./common.js";
import { checkCommand } from "./check.js";
export async function addCommand(options) {
    if (!options.file) {
        return errorResult("flux add: No input file specified.", "NO_INPUT");
    }
    let source;
    try {
        source = await readFileText(options.file);
    }
    catch (error) {
        return errorResult(`flux add: failed to read ${options.file}: ${error.message}`, "READ_ERROR", error);
    }
    let doc;
    try {
        doc = parseFlux(source, options.file);
    }
    catch (error) {
        return errorResult(`flux add: parse failed: ${error.message}`, "PARSE_ERROR", error);
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
    }
    catch (error) {
        return errorResult(`flux add: ${String(error?.message ?? error)}`, "ADD_FAILED", error);
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
//# sourceMappingURL=add.js.map