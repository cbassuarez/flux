export type FluxNpmBadgeSvgTheme = "light" | "dark";
export type FluxNpmBadgeSvgOptions = {
    version: string;
    markDataUri: string;
    theme?: FluxNpmBadgeSvgTheme;
    title?: string;
};
export declare function renderFluxNpmBadgeSvg({ version, markDataUri, theme, title, }: FluxNpmBadgeSvgOptions): string;
//# sourceMappingURL=flux-npm-svg.d.ts.map