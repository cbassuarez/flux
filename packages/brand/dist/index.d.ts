export declare const FLUX_TAGLINE = "procedurally evolving documents";
export type FluxChannel = "stable" | "canary";
export type FluxVersionInfo = {
    version: string;
    channel?: FluxChannel;
    build?: string;
    sha?: string;
    tagline: string;
};
export declare function formatFluxVersion(version: string): string;
export declare function coerceVersionInfo(input: Partial<FluxVersionInfo>): FluxVersionInfo;
//# sourceMappingURL=index.d.ts.map