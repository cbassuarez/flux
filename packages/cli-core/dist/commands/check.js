import { checkDocument, initRuntimeState } from "@flux-lang/core";
import { errorResult, okResult } from "../types.js";
import { formatIoError, formatParseOrLexerError, parseFlux, readSource } from "./common.js";
export async function checkCommand(options) {
    const files = options.files ?? [];
    if (files.length === 0) {
        return errorResult("flux check: No input files specified.", "NO_INPUT");
    }
    const results = [];
    for (const file of files) {
        let source;
        try {
            source = await readSource(file);
        }
        catch (error) {
            results.push({ file, ok: false, errors: [formatIoError(file, error)] });
            continue;
        }
        let doc;
        try {
            doc = parseFlux(source, file);
        }
        catch (error) {
            results.push({ file, ok: false, errors: [formatParseOrLexerError(file, error)] });
            continue;
        }
        const errors = [];
        try {
            initRuntimeState(doc);
        }
        catch (error) {
            const detail = error?.message ?? String(error);
            errors.push(`${file}:0:0: Check error: initRuntimeState failed: ${detail}`);
        }
        errors.push(...checkDocument(file, doc));
        results.push({ file, ok: errors.length === 0, errors: errors.length ? errors : undefined });
    }
    return okResult({ results });
}
//# sourceMappingURL=check.js.map