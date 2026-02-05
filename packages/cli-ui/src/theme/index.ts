import chalk from "chalk";

const ACCENT_START = "#00d1ff";
const ACCENT_END = "#2ef6a0";

const TRUECOLOR_ENV = ["truecolor", "24bit"];

export const isTruecolor = (() => {
  const env = process.env.COLORTERM?.toLowerCase() ?? "";
  if (TRUECOLOR_ENV.some((entry) => env.includes(entry))) return true;
  return chalk.level >= 3;
})();

export const color = {
  fg: isTruecolor ? "#e6e9f1" : "white",
  muted: isTruecolor ? "#9aa3b2" : "gray",
  border: isTruecolor ? "#2a323c" : "gray",
  panel: isTruecolor ? "#141820" : "black",
  panelAlt: isTruecolor ? "#1a202b" : "black",
  danger: isTruecolor ? "#ff6b6b" : "red",
};

const mutedRule = (width: number) => "-".repeat(Math.max(0, width));

function blendChannel(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function gradientText(text: string) {
  const chars = Array.from(text);
  if (chars.length === 0) return "";
  const start = hexToRgb(ACCENT_START);
  const end = hexToRgb(ACCENT_END);
  return chars
    .map((char, index) => {
      const t = chars.length === 1 ? 0 : index / (chars.length - 1);
      const r = blendChannel(start.r, end.r, t);
      const g = blendChannel(start.g, end.g, t);
      const b = blendChannel(start.b, end.b, t);
      return chalk.hex(rgbToHex(r, g, b))(char);
    })
    .join("");
}

export function accent(text: string) {
  if (!text) return "";
  if (!isTruecolor) {
    return chalk.cyan(text);
  }
  return gradientText(text);
}

export function accentRule(width: number) {
  const safeWidth = Math.max(0, width);
  if (safeWidth === 0) return "";
  const rule = "─".repeat(safeWidth);
  if (!isTruecolor) return chalk.cyan(rule);
  return gradientText(rule);
}

export function mutedRuleText(width: number) {
  const safeWidth = Math.max(0, width);
  if (safeWidth === 0) return "";
  if (!isTruecolor) return chalk.gray(mutedRule(safeWidth));
  return chalk.hex(color.border)("─".repeat(safeWidth));
}

export function truncateMiddle(value: string, max: number) {
  if (!value) return "";
  if (value.length <= max) return value;
  if (max <= 3) return value.slice(0, max);
  const keep = max - 3;
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return `${value.slice(0, head)}...${value.slice(value.length - tail)}`;
}

export const spacing = {
  xs: 1,
  sm: 2,
  md: 3,
};

export const theme = {
  color,
  isTruecolor,
  spacing,
  accent,
  accentRule,
  truncateMiddle,
};
