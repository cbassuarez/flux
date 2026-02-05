import { errorResult, okResult } from "../types.js";
import { attachOrStartViewer } from "../viewer/manager.js";
export async function viewCommand(options) {
    if (!options.docPath) {
        return errorResult("flux view: No input file specified.", "NO_INPUT");
    }
    if (options.docPath === "-") {
        return errorResult("flux view: stdin input is not supported for the web viewer.", "STDIN_UNSUPPORTED");
    }
    try {
        const session = await attachOrStartViewer({
            cwd: options.cwd,
            docPath: options.docPath,
            port: options.port,
            docstepMs: options.docstepMs,
            seed: options.seed,
            allowNet: options.allowNet,
            advanceTime: options.advanceTime,
            editorDist: options.editorDist,
        });
        return okResult({ session });
    }
    catch (error) {
        return errorResult(`flux view: ${String(error?.message ?? error)}`, "VIEW_ERROR", error);
    }
}
//# sourceMappingURL=view.js.map