import type { RenderAssetRef, RenderDocumentIR, RenderNodeIR, RenderValue } from "@flux-lang/core";
import Hypher from "hypher";
import enUsPatterns from "hyphenation.en-us";

export interface RenderHtmlAsset {
  id: string;
  url: string;
}

export interface RenderHtmlResult {
  html: string;
  css: string;
  assets: RenderHtmlAsset[];
  slots: Record<string, string>;
}

export interface RenderHtmlOptions {
  hyphenate?: boolean;
  page?: {
    width: number;
    height: number;
    units: string;
  };
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
    units: string;
  };
  fonts?: {
    body: string;
    heading: string;
    mono: string;
  };
  assetUrl?: (assetId: string) => string;
  rawUrl?: (raw: string) => string;
}

const DEFAULT_PAGE = { width: 8.5, height: 11, units: "in" };
const DEFAULT_MARGINS = { top: 1, right: 1, bottom: 1, left: 1, units: "in" };
const DEFAULT_FONTS = {
  body: '"Source Serif 4", "Times New Roman", serif',
  heading: '"Source Serif 4", "Times New Roman", serif',
  mono: '"Source Code Pro", "Courier New", monospace',
};

const hyphenator = new Hypher(enUsPatterns as any);

export function renderHtml(doc: RenderDocumentIR, options: RenderHtmlOptions = {}): RenderHtmlResult {
  const page = doc.pageConfig?.size ?? DEFAULT_PAGE;
  const margins = options.margins ?? DEFAULT_MARGINS;
  const fonts = options.fonts ?? DEFAULT_FONTS;
  const css = buildCss(page, margins, fonts);
  const assets = doc.assets.map((asset) => ({ id: asset.id, url: asset.path }));

  const slotMap: Record<string, string> = {};
  const html = [
    `<main class="flux-doc" data-flux-docstep="${doc.docstep}">`,
    doc.body
      .map((node) =>
        renderNode(node, {
          hyphenate: options.hyphenate !== false,
          slots: slotMap,
          assetUrl: options.assetUrl,
          rawUrl: options.rawUrl,
        }),
      )
      .join(""),
    `</main>`,
  ].join("");

  return { html, css, assets, slots: slotMap };
}

export function renderSlotMap(doc: RenderDocumentIR, options: RenderHtmlOptions = {}): Record<string, string> {
  const slotMap: Record<string, string> = {};
  const renderOptions = {
    hyphenate: options.hyphenate !== false,
    slots: slotMap,
    assetUrl: options.assetUrl,
    rawUrl: options.rawUrl,
  };
  doc.body.forEach((node) => {
    renderNode(node, renderOptions);
  });
  return slotMap;
}

function buildCss(
  page: { width: number; height: number; units: string },
  margins: { top: number; right: number; bottom: number; left: number; units: string },
  fonts: { body: string; heading: string; mono: string },
): string {
  const pageWidth = `${page.width}${page.units}`;
  const pageHeight = `${page.height}${page.units}`;
  const marginTop = `${margins.top}${margins.units}`;
  const marginRight = `${margins.right}${margins.units}`;
  const marginBottom = `${margins.bottom}${margins.units}`;
  const marginLeft = `${margins.left}${margins.units}`;

  return `
:root {
  --page-width: ${pageWidth};
  --page-height: ${pageHeight};
  --page-margin-top: ${marginTop};
  --page-margin-right: ${marginRight};
  --page-margin-bottom: ${marginBottom};
  --page-margin-left: ${marginLeft};
}

@page {
  size: ${pageWidth} ${pageHeight};
  margin: ${marginTop} ${marginRight} ${marginBottom} ${marginLeft};
}

* { box-sizing: border-box; }

body {
  margin: 0;
}

.flux-doc {
  counter-reset: flux-page;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  align-items: center;
  color: #141414;
  font-family: ${fonts.body};
  font-size: 11pt;
  line-height: 1.45;
  font-kerning: normal;
  font-feature-settings: "kern" 1, "liga" 1, "calt" 1;
  text-rendering: optimizeLegibility;
}

.flux-page {
  width: var(--page-width);
  height: var(--page-height);
  background: #fffdf8;
  color: inherit;
  box-shadow: 0 16px 30px rgba(20, 12, 8, 0.2);
  position: relative;
  counter-increment: flux-page;
  display: flex;
  flex-direction: column;
}

.flux-page-inner {
  flex: 1;
  padding: var(--page-margin-top) var(--page-margin-right) var(--page-margin-bottom) var(--page-margin-left);
}

.flux-page-number {
  position: absolute;
  bottom: 0.45in;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 9pt;
  color: #5f5a52;
  letter-spacing: 0.08em;
}

.flux-page-number::after {
  content: counter(flux-page);
}

.flux-section {
  margin: 0 0 18px 0;
}

.flux-text {
  margin: 0 0 12px 0;
  text-align: justify;
  hyphens: manual;
  widows: 2;
  orphans: 2;
}

.flux-text.inline {
  margin: 0;
}

.flux-row {
  display: flex;
  gap: 16px;
}

.flux-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.flux-figure {
  margin: 0 0 16px 0;
}

.flux-figure img {
  width: 100%;
  height: auto;
  display: block;
}

.flux-image {
  display: block;
  max-width: 100%;
  height: auto;
}

.flux-grid {
  display: grid;
  gap: 4px;
  border: 1px solid #bdb7ad;
  padding: 6px;
  font-size: 10pt;
}

.flux-grid-cell {
  border: 1px solid #d3cdc3;
  padding: 4px;
  min-height: 18px;
  background: #fbf8f2;
}

.flux-slot,
.flux-inline-slot {
  position: relative;
  overflow: hidden;
  border: 1px dashed rgba(120, 110, 98, 0.4);
}

.flux-slot {
  display: block;
}

.flux-inline-slot {
  display: inline-block;
  vertical-align: baseline;
}

.flux-slot-inner {
  width: 100%;
  height: 100%;
}

.flux-slot-inner > .flux-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.flux-fit-ellipsis .flux-slot-inner {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flux-fit-clip .flux-slot-inner {
  overflow: hidden;
}
`.trim();
}

function renderNode(
  node: RenderNodeIR,
  options: {
    hyphenate: boolean;
    slots: Record<string, string>;
    assetUrl?: (assetId: string) => string;
    rawUrl?: (raw: string) => string;
  },
  inlineContext = false,
): string {
  const childrenInline = node.kind === "text";
  const childHtml = node.children.map((child) => renderNode(child, options, childrenInline)).join("");
  const attrs = buildAttrs(node, inlineContext);

  switch (node.kind) {
    case "page":
      return `<section class="flux-page" ${attrs}><div class="flux-page-inner">${childHtml}</div><div class="flux-page-number"></div></section>`;
    case "section":
      return `<section class="flux-section" ${attrs}>${childHtml}</section>`;
    case "row":
      return `<div class="flux-row" ${attrs}>${childHtml}</div>`;
    case "column":
      return `<div class="flux-column" ${attrs}>${childHtml}</div>`;
    case "spacer": {
      const height = resolveNumeric(node.props.size, 12);
      return `<div class="flux-spacer" ${attrs} style="height:${height}px;"></div>`;
    }
    case "text": {
      const content = renderTextContent(node.props.content, options.hyphenate);
      const tag = inlineContext ? "span" : "p";
      const className = inlineContext ? "flux-text inline" : "flux-text";
      return `<${tag} class="${className}" ${attrs}>${content}${childHtml}</${tag}>`;
    }
    case "image":
      return renderImage(node, attrs, options);
    case "figure":
      return `<figure class="flux-figure" ${attrs}>${renderFigureMedia(node, options)}${childHtml}</figure>`;
    case "grid":
      return renderGrid(node, attrs);
    case "slot":
      return renderSlot(node, attrs, false, childHtml, options.slots);
    case "inline_slot":
      return renderSlot(node, attrs, true, childHtml, options.slots);
    default:
      return `<div class="flux-node" ${attrs}>${childHtml}</div>`;
  }
}

function renderSlot(
  node: RenderNodeIR,
  attrs: string,
  inline: boolean,
  childHtml: string,
  slots: Record<string, string>,
): string {
  slots[node.nodeId] = childHtml;
  const reserve = node.slot?.reserve;
  const fit = node.slot?.fit;
  const styleParts: string[] = [];
  if (reserve?.kind === "fixed") {
    styleParts.push(`width:${reserve.width}${reserve.units}`);
    styleParts.push(`height:${reserve.height}${reserve.units}`);
  }
  if (reserve?.kind === "fixedWidth") {
    styleParts.push(`width:${reserve.width}${reserve.units}`);
  }
  const style = styleParts.length ? ` style="${styleParts.join(";")}"` : "";
  const fitClass = fit ? ` flux-fit-${fit}` : "";
  const className = inline ? `flux-inline-slot${fitClass}` : `flux-slot${fitClass}`;
  return `<${inline ? "span" : "div"} class="${className}" ${attrs}${style}><div class="flux-slot-inner" data-flux-slot-inner>${childHtml}</div></${inline ? "span" : "div"}>`;
}

function renderImage(
  node: RenderNodeIR,
  attrs: string,
  options: { assetUrl?: (assetId: string) => string; rawUrl?: (raw: string) => string },
): string {
  const { src, assetId, raw } = resolveImageSource(node.props, options);
  const resolvedSrc = resolveImageUrl(src, assetId, raw, options.assetUrl, options.rawUrl);
  const extraAttrs = [
    assetId ? `data-flux-asset-id="${escapeAttr(assetId)}"` : "",
    raw ? `data-flux-src="${escapeAttr(raw)}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `<img class="flux-image" ${attrs} ${extraAttrs} src="${escapeAttr(resolvedSrc)}" alt="${escapeAttr(resolveString(node.props.alt))}">`;
}

function renderFigureMedia(
  node: RenderNodeIR,
  options: { assetUrl?: (assetId: string) => string; rawUrl?: (raw: string) => string },
): string {
  const { src, assetId, raw } = resolveImageSource(node.props, options);
  if (!src && !assetId && !raw) return "";
  const extraAttrs = [
    assetId ? `data-flux-asset-id="${escapeAttr(assetId)}"` : "",
    raw ? `data-flux-src="${escapeAttr(raw)}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const resolvedSrc = resolveImageUrl(src, assetId, raw, options.assetUrl, options.rawUrl);
  return `<img class="flux-image" ${extraAttrs} src="${escapeAttr(resolvedSrc)}" alt="">`;
}

function renderGrid(node: RenderNodeIR, attrs: string): string {
  if (!node.grid) {
    return `<div class="flux-grid" ${attrs}></div>`;
  }
  const { rows, cols, cells } = node.grid;
  const style = ` style="grid-template-columns: repeat(${cols}, 1fr);"`;
  const cellMap = new Map<string, string>();
  for (const cell of cells) {
    cellMap.set(`${cell.row}:${cell.col}`, escapeHtml(cell.content ?? ""));
  }
  const pieces: string[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const key = `${r}:${c}`;
      const value = cellMap.get(key) ?? "";
      pieces.push(`<div class="flux-grid-cell" data-cell="${r}-${c}">${value}</div>`);
    }
  }
  return `<div class="flux-grid" ${attrs}${style}>${pieces.join("")}</div>`;
}

function renderTextContent(value: RenderValue | undefined, hyphenate: boolean): string {
  const raw = resolveString(value);
  if (!raw) return "";
  const text = hyphenate ? hyphenateText(raw) : raw;
  return escapeHtml(text);
}

function resolveString(value: RenderValue | undefined): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => resolveString(item as RenderValue)).join(" ");
  if (typeof value === "object") {
    if ((value as RenderAssetRef).kind === "asset") {
      return (value as RenderAssetRef).name ?? "";
    }
    return "";
  }
  return "";
}

function resolveNumeric(value: RenderValue | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function resolveImageSource(
  props: Record<string, RenderValue>,
  options: { assetUrl?: (assetId: string) => string; rawUrl?: (raw: string) => string },
): { src: string; assetId: string | null; raw: string | null } {
  const asset = props.asset;
  if (asset && typeof asset === "object" && (asset as RenderAssetRef).kind === "asset") {
    return {
      src: transparentPixel(),
      assetId: (asset as RenderAssetRef).id,
      raw: null,
    };
  }
  const srcValue = resolveString(props.src);
  if (srcValue) {
    return { src: transparentPixel(), assetId: null, raw: srcValue };
  }
  return { src: transparentPixel(), assetId: null, raw: null };
}

function resolveImageUrl(
  fallback: string,
  assetId: string | null,
  raw: string | null,
  assetUrl?: (assetId: string) => string,
  rawUrl?: (raw: string) => string,
): string {
  if (assetId && assetUrl) {
    const resolved = assetUrl(assetId);
    if (resolved) return resolved;
  }
  if (raw && rawUrl) {
    const resolved = rawUrl(raw);
    if (resolved) return resolved;
  }
  return fallback;
}

function buildAttrs(node: RenderNodeIR, inline: boolean): string {
  const refresh = node.refresh?.kind ?? "onLoad";
  const attrs = [
    `data-flux-id="${escapeAttr(node.nodeId)}"`,
    `data-flux-node="${escapeAttr(node.id)}"`,
    `data-flux-kind="${escapeAttr(node.kind)}"`,
    `data-flux-refresh="${escapeAttr(refresh)}"`,
  ];
  if (node.slot?.fit) {
    attrs.push(`data-flux-fit="${escapeAttr(node.slot.fit)}"`);
  }
  if (node.slot?.reserve) {
    attrs.push(`data-flux-reserve="${escapeAttr(node.slot.reserve.kind)}"`);
  }
  if (inline) {
    attrs.push(`data-flux-inline="true"`);
  }
  return attrs.join(" ");
}

function hyphenateText(text: string): string {
  return text.replace(/\p{L}[\p{L}\p{N}]{3,}/gu, (word) => {
    const parts = hyphenator.hyphenate(word);
    if (parts.length <= 1) return word;
    return parts.join("\u00ad");
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

function transparentPixel(): string {
  return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
}
