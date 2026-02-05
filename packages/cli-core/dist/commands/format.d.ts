import { type CommandResult } from "../types.js";
export interface FormatOptions {
    file: string;
}
export interface FormatData {
    file: string;
}
export declare function formatCommand(options: FormatOptions): Promise<CommandResult<FormatData>>;
//# sourceMappingURL=format.d.ts.map