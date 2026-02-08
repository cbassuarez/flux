import type { FluxDocument } from "./ast.js";
/**
 * Run basic static checks on a FluxDocument.
 *
 * This is used by the CLI and can also be consumed by editor integrations.
 *
 * @param file - A label for the source (path or "<buffer>").
 * @param doc  - Parsed FluxDocument AST.
 * @returns An array of human-readable diagnostic strings.
 */
export declare function checkDocument(file: string, doc: FluxDocument): string[];
//# sourceMappingURL=checks.d.ts.map