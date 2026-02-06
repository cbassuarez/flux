import { createDocumentRuntimeIR, type RenderDocumentIR } from "@flux-lang/core";
import { renderHtml, type RenderHtmlResult } from "@flux-lang/render-html";
export declare const VIEWER_VERSION: string;
export interface ViewerServerOptions {
    docPath: string;
    port?: number;
    host?: string;
    docstepMs?: number;
    seed?: number;
    allowNet?: string[];
    docstepStart?: number;
    advanceTime?: boolean;
    timeRate?: number;
    editorDist?: string;
}
export interface ViewerServer {
    port: number;
    url: string;
    buildId?: string | null;
    editorDist?: string | null;
    close(): Promise<void>;
}
type ViewerRenderOptions = Parameters<typeof renderHtml>[1];
export declare function noCacheHeaders(extra?: Record<string, string>): Record<string, string>;
export declare function computeBuildId(dir: string | null | undefined, indexPath: string | null | undefined): Promise<string | null>;
export declare function advanceViewerRuntime(runtime: ReturnType<typeof createDocumentRuntimeIR>, renderOptions: ViewerRenderOptions, advanceTime: boolean, dtSeconds: number, timeRate: number): {
    ir: RenderDocumentIR;
    render: RenderHtmlResult;
};
export declare function startViewerServer(options: ViewerServerOptions): Promise<ViewerServer>;
export declare function getViewerJs(): string;
export { resolveEditorDist, defaultEmbeddedDir } from "./editor-dist.js";
//# sourceMappingURL=index.d.ts.map