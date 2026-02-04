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

export function okResult<T>(data: T, logs: string[] = [], warnings: string[] = []): CommandResult<T> {
  return { ok: true, data, logs: logs.length ? logs : undefined, warnings: warnings.length ? warnings : undefined };
}

export function errorResult<T>(message: string, code?: string, detail?: unknown): CommandResult<T> {
  return { ok: false, error: { message, code, detail } };
}
