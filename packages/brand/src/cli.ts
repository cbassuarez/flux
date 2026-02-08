import { coerceVersionInfo, formatFluxVersion, type FluxVersionInfo } from "./index.js";

type CliBrandOptions = {
  info: FluxVersionInfo;
  isOnline: boolean;
  width?: number;
};

function selectMarkGlyph(): string {
  if (typeof process === "undefined") return "◈";
  const term = (process.env.TERM ?? "").toLowerCase();
  if (term === "dumb") return "*";
  if (process.platform === "win32" && !process.env.WT_SESSION && !process.env.TERM_PROGRAM) return "*";
  return "◈";
}

function renderAnsiColor(char: string, r: number, g: number, b: number): string {
  return `\u001b[38;2;${r};${g};${b}m${char}\u001b[39m`;
}

function lerp(start: number, end: number, ratio: number): number {
  return Math.round(start + (end - start) * ratio);
}

function renderOnlineWordmark(wordmark: string): string {
  const start = { r: 84, g: 198, b: 214 };
  const end = { r: 125, g: 211, b: 145 };
  const chars = wordmark.split("");

  return chars
    .map((char, index) => {
      const ratio = chars.length <= 1 ? 0 : index / (chars.length - 1);
      return renderAnsiColor(
        char,
        lerp(start.r, end.r, ratio),
        lerp(start.g, end.g, ratio),
        lerp(start.b, end.b, ratio),
      );
    })
    .join("");
}

function renderOfflineWordmark(wordmark: string): string {
  return `\u001b[2m${wordmark}\u001b[22m`;
}

export function renderCliBrandHeader(opts: CliBrandOptions): string {
  const info = coerceVersionInfo(opts.info);
  const markGlyph = selectMarkGlyph();
  const wordmark = opts.isOnline ? renderOnlineWordmark("flux") : renderOfflineWordmark("flux");
  const version = `\u001b[90m ${formatFluxVersion(info.version)}\u001b[39m`;
  const line1 = `${markGlyph} ${wordmark}${version}`;
  const line2 = `\u001b[2m${info.tagline}\u001b[22m`;

  void opts.width;

  return `${line1}\n${line2}`;
}
