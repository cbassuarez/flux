import { type CommandResult } from "../types.js";
import { type ViewerSession } from "../viewer/manager.js";
export interface ViewOptions {
    cwd: string;
    docPath: string;
    port?: number;
    docstepMs?: number;
    seed?: number;
    allowNet?: string[];
    advanceTime?: boolean;
    editorDist?: string;
}
export interface ViewData {
    session: ViewerSession;
}
export declare function viewCommand(options: ViewOptions): Promise<CommandResult<ViewData>>;
//# sourceMappingURL=view.d.ts.map