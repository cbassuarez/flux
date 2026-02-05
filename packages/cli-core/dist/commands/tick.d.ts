import type { RenderDocumentIR } from "@flux-lang/core";
import { type CommandResult } from "../types.js";
export interface TickOptions {
    file: string;
    seconds: number;
    seed?: number;
}
export interface TickData {
    rendered: RenderDocumentIR;
}
export declare function tickCommand(options: TickOptions): Promise<CommandResult<TickData>>;
//# sourceMappingURL=tick.d.ts.map