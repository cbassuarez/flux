import { renderBadgeIconSvg } from "./badge-icons.js";
import {
  BADGE_ACCENTS,
  BADGE_FALLBACK_VALUE,
  BADGE_SIZE_TOKENS,
  BADGE_THEME_TOKENS,
  normalizeBadgeValue,
  type BadgeKind,
  type BadgeSize,
} from "./badge-shared.js";

export type BadgeSvgTheme = "light" | "dark";

export type BadgeSvgOptions = {
  kind: BadgeKind;
  label: string;
  value?: string;
  size?: BadgeSize;
  theme?: BadgeSvgTheme;
  title?: string;
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
  const condensed = text.trim();
  if (!condensed) return 0;
  const avgFactor = 0.58;
  return Math.ceil(condensed.length * fontSize * avgFactor);
}

export function renderBadgeSvg({
  kind,
  label,
  value,
  size = "md",
  theme = "light",
  title,
}: BadgeSvgOptions): string {
  const sizes = BADGE_SIZE_TOKENS[size];
  const tokens = BADGE_THEME_TOKENS[theme];
  const accent = BADGE_ACCENTS[kind];
  const normalizedValue = normalizeBadgeValue(value) ?? BADGE_FALLBACK_VALUE;
  const safeLabel = escapeXml(label);
  const safeValue = escapeXml(normalizedValue);

  const iconGap = sizes.gap;
  const labelWidth = estimateTextWidth(label, sizes.font);
  const valueWidth = estimateTextWidth(normalizedValue, sizes.valueFont);
  const separatorWidth = 1;
  const sectionSpacing = sizes.padX;
  const baseHeight = Math.max(20, sizes.font + sizes.padY * 2 + 6);
  const leftWidth = sectionSpacing + sizes.icon + iconGap + labelWidth + sectionSpacing;
  const rightWidth = sectionSpacing + valueWidth + sectionSpacing;
  const width = leftWidth + separatorWidth + rightWidth;
  const height = baseHeight;
  const centerY = height / 2;
  const iconY = centerY - sizes.icon / 2;
  const labelX = sectionSpacing + sizes.icon + iconGap;
  const valueX = leftWidth + separatorWidth + sectionSpacing;
  const labelY = centerY + sizes.font * 0.34;
  const valueY = centerY + sizes.valueFont * 0.34;

  const titleText = title ?? `${label}: ${normalizedValue}`;
  const safeTitle = escapeXml(titleText);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${safeTitle}">`,
    `<title>${safeTitle}</title>`,
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${sizes.radius}" fill="${tokens.surface}" stroke="${tokens.border}" />`,
    renderBadgeIconSvg(kind, accent, sizes.icon, sectionSpacing, iconY),
    `<text x="${labelX}" y="${labelY}" fill="${tokens.text}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace" font-size="${sizes.font}" font-weight="600">${safeLabel}</text>`,
    `<line x1="${leftWidth + 0.5}" y1="${Math.max(3, sizes.padY)}" x2="${leftWidth + 0.5}" y2="${height - Math.max(3, sizes.padY)}" stroke="${tokens.border}" />`,
    `<text x="${valueX}" y="${valueY}" fill="${tokens.muted}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace" font-size="${sizes.valueFont}" font-weight="500">${safeValue}</text>`,
    "</svg>",
  ].join("");
}
