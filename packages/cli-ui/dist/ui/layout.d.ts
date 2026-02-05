export declare const MIN_COLS = 80;
export declare const MIN_ROWS = 24;
export declare const DEFAULT_COLS = 80;
export declare const DEFAULT_ROWS = 24;
export type LayoutMetrics = {
    columns: number;
    rows: number;
    innerWidth: number;
    overlayWidth: number;
    navWidth: number;
    paneWidth: number;
    navContentWidth: number;
    paneContentWidth: number;
    navListHeight: number;
};
export declare function clamp(value: number, min: number, max: number): number;
export declare function normalizeDimension(value: number | undefined, fallback: number): number;
export declare function getLayoutMetrics(columns: number, rows: number): LayoutMetrics;
export declare function isTerminalTooSmall(columns: number, rows: number): boolean;
//# sourceMappingURL=layout.d.ts.map