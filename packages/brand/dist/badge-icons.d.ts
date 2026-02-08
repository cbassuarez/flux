import type { BadgeKind } from "./badge-shared.js";
type CommonShape = {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    linecap?: "butt" | "round" | "square";
    linejoin?: "miter" | "round" | "bevel";
};
export type BadgeIconShape = ({
    type: "path";
    d: string;
} & CommonShape) | ({
    type: "circle";
    cx: number;
    cy: number;
    r: number;
} & CommonShape) | ({
    type: "rect";
    x: number;
    y: number;
    width: number;
    height: number;
    rx?: number;
} & CommonShape);
export declare function getBadgeIconShapes(kind: BadgeKind): BadgeIconShape[];
export declare function shapeToSvg(shape: BadgeIconShape, color: string, x?: number, y?: number): string;
export declare function renderBadgeIconSvg(kind: BadgeKind, color: string, size: number, x: number, y: number): string;
export {};
//# sourceMappingURL=badge-icons.d.ts.map