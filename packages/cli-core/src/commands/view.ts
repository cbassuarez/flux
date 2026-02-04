import { errorResult, okResult, type CommandResult } from "../types.js";
import { attachOrStartViewer, type ViewerSession } from "../viewer/manager.js";

export interface ViewOptions {
  cwd: string;
  docPath: string;
  port?: number;
  docstepMs?: number;
  seed?: number;
  allowNet?: string[];
  advanceTime?: boolean;
}

export interface ViewData {
  session: ViewerSession;
}

export async function viewCommand(options: ViewOptions): Promise<CommandResult<ViewData>> {
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
    });
    return okResult({ session });
  } catch (error) {
    return errorResult(`flux view: ${String((error as Error)?.message ?? error)}`, "VIEW_ERROR", error);
  }
}
