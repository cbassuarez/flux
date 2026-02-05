export type PaletteGroup = "Commands" | "Docs" | "Templates" | "Files";
export type PaletteItem = {
    id: string;
    label: string;
    group: PaletteGroup;
    kind: "action" | "template" | "doc" | "file";
    payload?: any;
    hint?: string;
};
export declare function buildPaletteItems(options: {
    recents: {
        path: string;
    }[];
    fluxFiles: string[];
    activeDoc?: string | null;
}): PaletteItem[];
export declare function filterPaletteItems(items: PaletteItem[], query: string): PaletteItem[];
export declare function groupPaletteItems(items: PaletteItem[]): {
    group: PaletteGroup;
    items: PaletteItem[];
}[];
//# sourceMappingURL=index.d.ts.map