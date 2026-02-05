export const MIN_COLS = 80;
export const MIN_ROWS = 24;
export const DEFAULT_COLS = 80;
export const DEFAULT_ROWS = 24;
export function clamp(value, min, max) {
    const upper = Math.max(min, max);
    return Math.min(upper, Math.max(min, value));
}
export function normalizeDimension(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
export function getLayoutMetrics(columns, rows) {
    const safeColumns = Math.max(0, columns);
    const safeRows = Math.max(0, rows);
    const innerWidth = clamp(safeColumns - 4, 20, safeColumns);
    const overlayWidth = clamp(Math.min(72, innerWidth - 4), 28, innerWidth);
    const navWidth = clamp(Math.floor(innerWidth * 0.34), 20, 32);
    const paneWidth = clamp(innerWidth - navWidth - 2, 20, innerWidth);
    const navContentWidth = clamp(navWidth - 4, 12, navWidth);
    const paneContentWidth = clamp(paneWidth - 4, 20, paneWidth);
    const navListHeight = clamp(safeRows - 14, 8, safeRows);
    return {
        columns: safeColumns,
        rows: safeRows,
        innerWidth,
        overlayWidth,
        navWidth,
        paneWidth,
        navContentWidth,
        paneContentWidth,
        navListHeight,
    };
}
export function isTerminalTooSmall(columns, rows) {
    return columns < MIN_COLS || rows < MIN_ROWS;
}
//# sourceMappingURL=layout.js.map