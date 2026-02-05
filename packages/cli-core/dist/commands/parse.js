import { errorResult, okResult } from "../types.js";
import { formatIoError, formatParseOrLexerError, parseFlux, readSource } from "./common.js";
export async function parseCommand(options) {
    const files = options.files ?? [];
    if (files.length === 0) {
        return errorResult("flux parse: No input files specified.", "NO_INPUT");
    }
    const usesStdin = files.includes("-");
    if (usesStdin && files.length > 1) {
        return errorResult("flux parse: '-' (stdin) can only be used with a single input.", "STDIN_MULTI");
    }
    if (options.pretty && options.compact && !options.ndjson) {
        return errorResult("flux parse: --pretty and --compact are mutually exclusive.", "INVALID_FLAGS");
    }
    const docs = [];
    for (const file of files) {
        let source;
        try {
            source = await readSource(file);
        }
        catch (error) {
            return errorResult(formatIoError(file, error), "READ_ERROR", error);
        }
        try {
            const doc = parseFlux(source, file);
            docs.push({ file: file === "-" ? "<stdin>" : file, doc });
        }
        catch (error) {
            return errorResult(formatParseOrLexerError(file, error), "PARSE_ERROR", error);
        }
    }
    const ndjson = options.ndjson ?? docs.length > 1;
    const pretty = options.pretty ?? (docs.length === 1 && !options.compact);
    const compact = options.compact ?? false;
    return okResult({ docs, ndjson, pretty, compact });
}
//# sourceMappingURL=parse.js.map