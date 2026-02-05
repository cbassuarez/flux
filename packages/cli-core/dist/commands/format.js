import path from "node:path";
import { errorResult, okResult } from "../types.js";
import { readFileText, writeFileText } from "../fs.js";
export async function formatCommand(options) {
    if (!options.file) {
        return errorResult("flux fmt: No input file specified.", "NO_INPUT");
    }
    let source;
    try {
        source = await readFileText(options.file);
    }
    catch (error) {
        return errorResult(`flux fmt: failed to read ${options.file}: ${error.message}`, "READ_ERROR", error);
    }
    const formatted = formatFluxSource(source);
    await writeFileText(path.resolve(options.file), formatted);
    return okResult({ file: options.file });
}
function formatFluxSource(source) {
    const trimmed = source.replace(/[\t ]+\n/g, "\n");
    return trimmed.endsWith("\n") ? trimmed : trimmed + "\n";
}
//# sourceMappingURL=format.js.map