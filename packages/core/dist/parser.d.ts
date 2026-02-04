import { FluxDocument } from "./ast.js";
export interface ParseOptions {
    sourcePath?: string;
    docRoot?: string;
    resolveIncludes?: boolean;
    maxIncludeBytes?: number;
    includeDepthLimit?: number;
    allowBodyFragments?: boolean;
}
export declare function parseDocument(source: string, options?: ParseOptions): FluxDocument;
//# sourceMappingURL=parser.d.ts.map