import { type CommandResult } from "../types.js";
export interface CheckOptions {
    files: string[];
    json?: boolean;
}
export interface CheckResult {
    file: string;
    ok: boolean;
    errors?: string[];
}
export interface CheckData {
    results: CheckResult[];
}
export declare function checkCommand(options: CheckOptions): Promise<CommandResult<CheckData>>;
//# sourceMappingURL=check.d.ts.map