import type { BadgeKind } from "./badge-shared.js";

type CommonShape = {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  linecap?: "butt" | "round" | "square";
  linejoin?: "miter" | "round" | "bevel";
};

export type BadgeIconShape =
  | ({ type: "path"; d: string } & CommonShape)
  | ({ type: "circle"; cx: number; cy: number; r: number } & CommonShape)
  | ({ type: "rect"; x: number; y: number; width: number; height: number; rx?: number } & CommonShape);

export function getBadgeIconShapes(kind: BadgeKind): BadgeIconShape[] {
  switch (kind) {
    case "npm":
      return [
        { type: "rect", x: 2, y: 3, width: 12, height: 10, rx: 2, stroke: "currentColor", strokeWidth: 1.4, fill: "none" },
        { type: "path", d: "M2.7 6.8H13.3", stroke: "currentColor", strokeWidth: 1.3, linecap: "round" },
        { type: "path", d: "M8 3.3V12.8", stroke: "currentColor", strokeWidth: 1.3, linecap: "round" },
      ];
    case "channel":
      return [
        { type: "circle", cx: 3.2, cy: 4.2, r: 1.3, fill: "currentColor" },
        { type: "circle", cx: 11.6, cy: 4.2, r: 1.3, fill: "currentColor" },
        { type: "circle", cx: 7.4, cy: 11.8, r: 1.3, fill: "currentColor" },
        { type: "path", d: "M4.3 5.2L6.5 10.5", stroke: "currentColor", strokeWidth: 1.2, linecap: "round" },
        { type: "path", d: "M10.5 5.2L8.3 10.5", stroke: "currentColor", strokeWidth: 1.2, linecap: "round" },
      ];
    case "ci":
      return [
        { type: "circle", cx: 8, cy: 8, r: 6, stroke: "currentColor", strokeWidth: 1.4, fill: "none" },
        { type: "path", d: "M4.9 8.4L7.2 10.7L11.4 6.6", stroke: "currentColor", strokeWidth: 1.5, linecap: "round", linejoin: "round" },
      ];
    case "license":
      return [
        { type: "rect", x: 3, y: 2.5, width: 10, height: 11, rx: 2, stroke: "currentColor", strokeWidth: 1.4, fill: "none" },
        { type: "path", d: "M5.2 6H10.8", stroke: "currentColor", strokeWidth: 1.2, linecap: "round" },
        { type: "path", d: "M5.2 8.7H10.8", stroke: "currentColor", strokeWidth: 1.2, linecap: "round" },
        { type: "path", d: "M5.2 11.4H8.8", stroke: "currentColor", strokeWidth: 1.2, linecap: "round" },
      ];
    case "docs":
      return [
        { type: "path", d: "M3 3.5H8.1C9.1 3.5 10 4.3 10 5.4V12.5H4.2C3.5 12.5 3 12 3 11.3V3.5Z", stroke: "currentColor", strokeWidth: 1.3, fill: "none", linejoin: "round" },
        { type: "path", d: "M13 3.5H7.9C6.9 3.5 6 4.3 6 5.4V12.5H11.8C12.5 12.5 13 12 13 11.3V3.5Z", stroke: "currentColor", strokeWidth: 1.3, fill: "none", linejoin: "round" },
      ];
    case "discord":
      return [
        { type: "rect", x: 2.5, y: 3, width: 11, height: 8.5, rx: 2.3, stroke: "currentColor", strokeWidth: 1.4, fill: "none" },
        { type: "path", d: "M6.2 11.6L5.2 14L7.8 12.2", fill: "currentColor" },
        { type: "circle", cx: 6.2, cy: 7.1, r: 0.8, fill: "currentColor" },
        { type: "circle", cx: 9.8, cy: 7.1, r: 0.8, fill: "currentColor" },
      ];
    case "security":
      return [
        { type: "path", d: "M8 2.3L12.8 4.1V8.2C12.8 10.9 10.9 13.1 8 13.9C5.1 13.1 3.2 10.9 3.2 8.2V4.1L8 2.3Z", stroke: "currentColor", strokeWidth: 1.3, fill: "none", linejoin: "round" },
        { type: "path", d: "M5.8 8.1L7.3 9.6L10.2 6.7", stroke: "currentColor", strokeWidth: 1.4, linecap: "round", linejoin: "round" },
      ];
    case "maintained":
      return [
        { type: "circle", cx: 8, cy: 8, r: 6, stroke: "currentColor", strokeWidth: 1.3, fill: "none" },
        { type: "path", d: "M4.3 8H6.1L7.3 6.1L8.9 10.2L10.2 8H11.7", stroke: "currentColor", strokeWidth: 1.3, linecap: "round", linejoin: "round" },
      ];
    default:
      return [{ type: "circle", cx: 8, cy: 8, r: 4, fill: "currentColor" }];
  }
}

function resolvePaint(value: string | undefined, color: string): string | undefined {
  if (!value) return undefined;
  return value === "currentColor" ? color : value;
}

export function shapeToSvg(shape: BadgeIconShape, color: string, x = 0, y = 0): string {
  const fill = resolvePaint(shape.fill, color);
  const stroke = resolvePaint(shape.stroke, color);
  const strokeWidth = shape.strokeWidth;
  const linecap = shape.linecap;
  const linejoin = shape.linejoin;

  const styleBits = [
    fill ? `fill="${fill}"` : 'fill="none"',
    stroke ? `stroke="${stroke}"` : "",
    strokeWidth ? `stroke-width="${strokeWidth}"` : "",
    linecap ? `stroke-linecap="${linecap}"` : "",
    linejoin ? `stroke-linejoin="${linejoin}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (shape.type === "path") {
    return `<path d="${shape.d}" transform="translate(${x} ${y})" ${styleBits} />`;
  }

  if (shape.type === "circle") {
    return `<circle cx="${shape.cx + x}" cy="${shape.cy + y}" r="${shape.r}" ${styleBits} />`;
  }

  return `<rect x="${shape.x + x}" y="${shape.y + y}" width="${shape.width}" height="${shape.height}"${shape.rx ? ` rx="${shape.rx}"` : ""} ${styleBits} />`;
}

export function renderBadgeIconSvg(kind: BadgeKind, color: string, size: number, x: number, y: number): string {
  const scale = size / 16;
  const transform = `translate(${x} ${y}) scale(${scale})`;
  const parts = getBadgeIconShapes(kind).map((shape) => shapeToSvg(shape, color));
  return `<g transform="${transform}">${parts.join("")}</g>`;
}
