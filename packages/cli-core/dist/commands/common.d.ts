import { type FluxDocument } from "@flux-lang/core";
export declare function readSource(file: string): Promise<string>;
export declare function parseFlux(source: string, filePath: string | null): FluxDocument;
export declare function formatIoError(file: string, error: unknown): string;
export declare function formatParseOrLexerError(file: string, error: unknown): string;
//# sourceMappingURL=common.d.ts.map