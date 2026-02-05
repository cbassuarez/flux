import type { FluxDocument } from "@flux-lang/core";
import { type CommandResult } from "../types.js";
export interface ParseOptions {
    files: string[];
    ndjson?: boolean;
    pretty?: boolean;
    compact?: boolean;
}
export interface ParsedDoc {
    file: string;
    doc: FluxDocument;
}
export interface ParseData {
    docs: ParsedDoc[];
    ndjson: boolean;
    pretty: boolean;
    compact: boolean;
}
export declare function parseCommand(options: ParseOptions): Promise<CommandResult<ParseData>>;
//# sourceMappingURL=parse.d.ts.map