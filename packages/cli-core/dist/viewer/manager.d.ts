import { type ViewerServer, type ViewerServerOptions } from "@flux-lang/viewer";
export interface ViewerRegistryEntry {
    docPath: string;
    url: string;
    port: number;
    pid?: number;
    startedAt: string;
    lastSeen: string;
    buildId?: string | null;
    editorDist?: string | null;
}
export interface ViewerRegistry {
    entries: ViewerRegistryEntry[];
    filePath: string;
    repoRoot: string | null;
    fallback: boolean;
}
export interface ViewerSession {
    docPath: string;
    url: string;
    port: number;
    attached: boolean;
    buildId?: string | null;
    editorDist?: string | null;
    server?: ViewerServer;
    close?: () => Promise<void>;
}
export interface ViewerStartOptions extends ViewerServerOptions {
    cwd: string;
}
interface ExpectedComponents {
    viewerVersion: string;
    editorBuildId: string | null;
}
interface HealthSnapshot {
    viewerVersion: string | null;
    editorBuildId: string | null;
}
export declare function validateHandshake(expected: ExpectedComponents, health: HealthSnapshot): string | null;
export declare function attachOrStartViewer(options: ViewerStartOptions): Promise<ViewerSession>;
export declare function updateViewerTicker(url: string, payload: {
    running?: boolean;
    docstepMs?: number;
}): Promise<boolean>;
export declare function updateViewerRuntime(url: string, payload: {
    seed?: number;
    docstep?: number;
    time?: number;
}): Promise<boolean>;
export declare function fetchViewerStatus(url: string): Promise<any>;
export declare function fetchViewerPatch(url: string): Promise<any>;
export declare function fetchViewerRender(url: string): Promise<any>;
export declare function requestViewerPdf(url: string): Promise<Uint8Array>;
export {};
//# sourceMappingURL=manager.d.ts.map