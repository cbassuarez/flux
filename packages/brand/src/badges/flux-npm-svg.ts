export type FluxNpmBadgeSvgTheme = "light" | "dark";

export type FluxNpmBadgeSvgOptions = {
  version: string;
  markDataUri: string;
  theme?: FluxNpmBadgeSvgTheme;
  title?: string;
};

const PACKAGE_LABEL = "@flux-lang/flux";
const PACKAGE_LABEL_UPPER = PACKAGE_LABEL.toUpperCase();

type FluxNpmThemeTokens = {
  surface: string;
  border: string;
  text: string;
  muted: string;
  separator: string;
};

const TOKENS: Record<FluxNpmBadgeSvgTheme, FluxNpmThemeTokens> = {
  light: {
    surface: "rgba(255, 255, 255, 0.9)",
    border: "#e2e8f0",
    text: "#0f172a",
    muted: "#64748b",
    separator: "#e2e8f0",
  },
  dark: {
    surface: "rgba(15, 23, 42, 0.9)",
    border: "rgba(148, 163, 184, 0.45)",
    text: "#e2e8f0",
    muted: "#94a3b8",
    separator: "rgba(148, 163, 184, 0.45)",
  },
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function estimateTextWidth(text: string, fontSize: number): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.ceil(trimmed.length * fontSize * 0.58);
}

function normalizeVersion(version: string): string {
  const trimmed = (version ?? "").trim();
  if (!trimmed) return "v0.0.0-dev";
  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}

export function renderFluxNpmBadgeSvg({
  version,
  markDataUri,
  theme = "light",
  title,
}: FluxNpmBadgeSvgOptions): string {
  const tokens = TOKENS[theme];
  const safeVersion = normalizeVersion(version);
  const safeTitle = escapeXml(title ?? `${PACKAGE_LABEL} ${safeVersion}`);
  const safeLabel = escapeXml(PACKAGE_LABEL_UPPER);
  const safeVersionLabel = escapeXml(safeVersion);
  const safeMarkDataUri = escapeXml(markDataUri);

  const fontSize = 11;
  const valueFontSize = 11;
  const markSize = 16;
  const height = 25;
  const leftPad = 10;
  const rightPad = 10;
  const iconGap = 8;
  const labelWidth = estimateTextWidth(PACKAGE_LABEL_UPPER, fontSize);
  const valueWidth = estimateTextWidth(safeVersion, valueFontSize);
  const separatorWidth = 1;
  const leftWidth = leftPad + markSize + iconGap + labelWidth + rightPad;
  const rightWidth = rightPad + valueWidth + rightPad;
  const width = leftWidth + separatorWidth + rightWidth;
  const centerY = height / 2;
  const baselineY = centerY + fontSize * 0.34;
  const valueBaselineY = centerY + valueFontSize * 0.34;
  const markY = centerY - markSize / 2;
  const separatorX = leftWidth + 0.5;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${safeTitle}">`,
    `<title>${safeTitle}</title>`,
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="9" fill="${tokens.surface}" stroke="${tokens.border}" />`,
    `<image href="${safeMarkDataUri}" x="${leftPad}" y="${markY}" width="${markSize}" height="${markSize}" preserveAspectRatio="xMidYMid meet" />`,
    `<text x="${leftPad + markSize + iconGap}" y="${baselineY}" fill="${tokens.text}" font-family="ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="600" letter-spacing="0.4">${safeLabel}</text>`,
    `<line x1="${separatorX}" y1="4" x2="${separatorX}" y2="${height - 4}" stroke="${tokens.separator}" />`,
    `<text x="${leftWidth + separatorWidth + rightPad}" y="${valueBaselineY}" fill="${tokens.muted}" font-family="ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="${valueFontSize}" font-weight="500">${safeVersionLabel}</text>`,
    "</svg>",
  ].join("");
}
