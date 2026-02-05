import path from "node:path";
import { createDocumentRuntimeIR } from "@flux-lang/core";
import { errorResult, okResult } from "../types.js";
import { formatIoError, formatParseOrLexerError, parseFlux, readSource } from "./common.js";
export async function tickCommand(options) {
    if (!options.file) {
        return errorResult("flux tick: No input file specified.", "NO_INPUT");
    }
    if (!Number.isFinite(options.seconds)) {
        return errorResult("flux tick: --seconds is required.", "MISSING_SECONDS");
    }
    let source;
    try {
        source = await readSource(options.file);
    }
    catch (error) {
        return errorResult(formatIoError(options.file, error), "READ_ERROR", error);
    }
    let doc;
    try {
        doc = parseFlux(source, options.file);
    }
    catch (error) {
        return errorResult(formatParseOrLexerError(options.file, error), "PARSE_ERROR", error);
    }
    const dir = options.file === "-" ? process.cwd() : path.dirname(path.resolve(options.file));
    const runtime = createDocumentRuntimeIR(doc, { seed: options.seed, assetCwd: dir });
    const rendered = runtime.tick(options.seconds);
    return okResult({ rendered });
}
//# sourceMappingURL=tick.js.map