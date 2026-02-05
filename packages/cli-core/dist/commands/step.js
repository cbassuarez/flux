import path from "node:path";
import { createDocumentRuntimeIR } from "@flux-lang/core";
import { errorResult, okResult } from "../types.js";
import { formatIoError, formatParseOrLexerError, parseFlux, readSource } from "./common.js";
export async function stepCommand(options) {
    if (!options.file) {
        return errorResult("flux step: No input file specified.", "NO_INPUT");
    }
    const count = options.steps ?? 1;
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
    const rendered = runtime.step(count);
    return okResult({ rendered });
}
//# sourceMappingURL=step.js.map