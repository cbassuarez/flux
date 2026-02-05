import { type RenderDocumentIR } from "@flux-lang/core";
import { type CommandResult } from "../types.js";
export interface RenderOptions {
    file: string;
    format?: "ir";
    seed?: number;
    time?: number;
    docstep?: number;
}
export interface RenderData {
    rendered: RenderDocumentIR;
}
export declare function renderCommand(options: RenderOptions): Promise<CommandResult<RenderData>>;
//# sourceMappingURL=render.d.ts.map