export declare function ViewerControlScreen({ width, activeDoc, viewerUrl, viewerStatus, streamOk, backend, debug, }: {
    width: number;
    activeDoc: string | null;
    viewerUrl?: string;
    viewerStatus?: {
        docstep: number;
        time: number;
        running: boolean;
        docstepMs: number;
        seed: number;
    } | null;
    streamOk: boolean;
    backend: string;
    debug?: boolean;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=ViewerControlScreen.d.ts.map