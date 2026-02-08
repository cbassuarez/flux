import { type BadgeKind, type BadgeSize } from "./badge-shared.js";
export type BadgeSvgTheme = "light" | "dark";
export type BadgeSvgOptions = {
    kind: BadgeKind;
    label: string;
    value?: string;
    size?: BadgeSize;
    theme?: BadgeSvgTheme;
    title?: string;
};
export declare function renderBadgeSvg({ kind, label, value, size, theme, title, }: BadgeSvgOptions): string;
//# sourceMappingURL=badge-svg.d.ts.map