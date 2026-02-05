import type { RenderDocumentIR } from "@flux-lang/core";
import { type CommandResult } from "../types.js";
export interface StepOptions {
    file: string;
    steps?: number;
    seed?: number;
}
export interface StepData {
    rendered: RenderDocumentIR;
}
export declare function stepCommand(options: StepOptions): Promise<CommandResult<StepData>>;
//# sourceMappingURL=step.d.ts.map