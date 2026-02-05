export interface CommandError {
    message: string;
    code?: string;
    detail?: unknown;
}
export interface CommandResult<T = unknown> {
    ok: boolean;
    data?: T;
    error?: CommandError;
    warnings?: string[];
    logs?: string[];
}
export type ResultLogLevel = "info" | "warn" | "error";
export interface ResultLogEntry {
    level: ResultLogLevel;
    message: string;
}
export interface CommandResultWithLogs<T = unknown> extends CommandResult<T> {
    logEntries?: ResultLogEntry[];
}
export declare function okResult<T>(data: T, logs?: string[], warnings?: string[]): CommandResult<T>;
export declare function errorResult<T>(message: string, code?: string, detail?: unknown): CommandResult<T>;
//# sourceMappingURL=types.d.ts.map