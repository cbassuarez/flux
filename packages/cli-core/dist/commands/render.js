import path from "node:path";
import { renderDocumentIR } from "@flux-lang/core";
import { errorResult, okResult } from "../types.js";
import { formatIoError, formatParseOrLexerError, parseFlux, readSource } from "./common.js";
export async function renderCommand(options) {
    const file = options.file;
    if (!file) {
        return errorResult("flux render: No input file specified.", "NO_INPUT");
    }
    const format = options.format ?? "ir";
    if (format !== "ir") {
        return errorResult(`flux render: Unsupported format '${format}'.`, "UNSUPPORTED_FORMAT");
    }
    let source;
    try {
        source = await readSource(file);
    }
    catch (error) {
        return errorResult(formatIoError(file, error), "READ_ERROR", error);
    }
    let doc;
    try {
        doc = parseFlux(source, file);
    }
    catch (error) {
        return errorResult(formatParseOrLexerError(file, error), "PARSE_ERROR", error);
    }
    if (!doc.meta?.target) {
        doc = { ...doc, meta: { ...doc.meta, target: "print" } };
    }
    const dir = file === "-" ? process.cwd() : path.dirname(path.resolve(file));
    const rendered = renderDocumentIR(doc, {
        seed: options.seed,
        time: options.time,
        docstep: options.docstep,
        assetCwd: dir,
    });
    return okResult({ rendered });
}
//# sourceMappingURL=render.js.map