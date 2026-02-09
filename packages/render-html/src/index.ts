import type {
  RenderAssetRef,
  RenderDocumentIR,
  RenderNodeIR,
  RenderStyleDefinition,
  RenderValue,
} from "@flux-lang/core";
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
const DEFAULT_MARGINS = { top: 1, right: 1, bottom: 1.1, left: 1, units: "in" };
const DEFAULT_FONTS = {
  body: '"Iowan Old Style", "Palatino Linotype", Palatino, "Times New Roman", serif',
  heading: '"Iowan Old Style", "Palatino Linotype", Palatino, "Times New Roman", serif',
  mono: '"Source Code Pro", "Courier New", monospace',
};

const hyphenator = new Hypher(enUsPatterns as any);

export function renderHtml(doc: RenderDocumentIR, options: RenderHtmlOptions = {}): RenderHtmlResult {
  const page = options.page ?? doc.pageConfig?.size ?? DEFAULT_PAGE;
  const margins = options.margins ?? DEFAULT_MARGINS;
  const fonts = options.fonts ?? DEFAULT_FONTS;
  const css = buildCss(doc, page, margins, fonts);
  const assets = doc.assets.map((asset) => ({ id: asset.id, url: asset.path }));

  const slotMap: Record<string, string> = {};
  const theme = doc.theme ?? "screen";
  const html = [
    `<main class="flux-doc" data-flux-docstep="${doc.docstep}" data-flux-theme="${escapeAttr(theme)}">`,
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
  doc: RenderDocumentIR,
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
  const styleCss = buildStyleCss(doc.styles ?? []);

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
  background: #ebe6df;
}

.flux-doc {
  --doc-bg: #ebe6df;
  --page-bg: #fffdf9;
  --page-border: #d8d0c4;
  --page-shadow: 0 16px 30px rgba(20, 12, 8, 0.18);
  --page-number-color: #5f5a52;
  --rule-color: #d1c8bb;
  --link-color: #2b4c7e;
  counter-reset: flux-page;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  align-items: center;
  color: #141414;
  font-family: ${fonts.body};
  font-size: 10.8pt;
  line-height: 1.4;
  font-kerning: normal;
  font-feature-settings: "kern" 1, "liga" 1, "calt" 1;
  text-rendering: optimizeLegibility;
}

.flux-doc[data-flux-theme="print"] {
  --doc-bg: #ffffff;
  --page-bg: #ffffff;
  --page-border: transparent;
  --page-shadow: none;
  --page-number-color: #222222;
  --rule-color: #bbbbbb;
  --link-color: #000000;
}

.flux-doc[data-flux-theme="screen"] {
  --doc-bg: #ebe6df;
}

.flux-page {
  width: var(--page-width);
  height: var(--page-height);
  background: var(--page-bg);
  color: inherit;
  box-shadow: var(--page-shadow);
  border: 1px solid var(--page-border);
  position: relative;
  counter-increment: flux-page;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  color: var(--page-number-color);
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
  text-justify: inter-word;
  hyphens: manual;
  widows: 2;
  orphans: 2;
}

.flux-text.inline {
  margin: 0;
  text-align: inherit;
}

.flux-text-title,
.flux-text-subtitle,
.flux-text-heading,
.flux-text-edition,
.flux-text-label,
.flux-text-caption,
.flux-text-credit,
.flux-text-note,
.flux-text-sample,
.flux-text-list,
.flux-text-end {
  font: inherit;
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

.flux-figure figcaption {
  margin-top: 6px;
}

.flux-image {
  display: block;
  max-width: 100%;
  height: auto;
}

.flux-blockquote {
  margin: 12px 0;
  padding: 0 0 0 12px;
  border-left: 2px solid var(--rule-color);
}

.flux-codeblock {
  margin: 12px 0;
  padding: 10px 12px;
  background: #f4f0e9;
  border-radius: 6px;
  border: 1px solid #e2dccf;
  font-family: ${fonts.mono};
  font-size: 9.5pt;
  white-space: pre-wrap;
}

.flux-codeblock code {
  font-family: inherit;
}

.flux-callout {
  margin: 12px 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: #f6f1e8;
  border: 1px solid #d9d0c4;
}

.flux-callout-info {
  border-left: 4px solid #7c8aa0;
}

.flux-callout-warn {
  border-left: 4px solid #b65f32;
}

.flux-callout-note {
  border-left: 4px solid #7b6b5d;
}

.flux-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9.5pt;
}

.flux-table th,
.flux-table td {
  border-bottom: 1px solid var(--rule-color);
  padding: 4px 6px;
  vertical-align: top;
}

.flux-hr {
  border: none;
  border-top: 1px solid var(--rule-color);
  margin: 12px 0;
}

.flux-list {
  margin: 8px 0 12px;
  padding-left: 1.4em;
}

.flux-list li {
  margin: 4px 0;
}

.flux-smallcaps {
  font-variant: small-caps;
  letter-spacing: 0.04em;
}

.flux-link {
  color: var(--link-color);
  text-decoration: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.2);
}

.flux-mark {
  background: #fef3c7;
  padding: 0 0.12em;
}

code,
.flux-code {
  font-family: ${fonts.mono};
  font-size: 0.95em;
}

.flux-footnote-ref {
  font-size: 0.75em;
  vertical-align: super;
}

.flux-footnotes {
  margin-top: 18px;
  padding-top: 8px;
  border-top: 1px solid var(--rule-color);
  font-size: 8.5pt;
  color: #5f5a52;
}

.flux-footnotes ol {
  margin: 0;
  padding-left: 1.2em;
}

.flux-footnotes li {
  margin: 4px 0;
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
}

.flux-slot {
  display: block;
  border: 1px solid #d2cbc0;
  background: #ffffff;
  border-radius: 3px;
}

.flux-inline-slot {
  display: inline-block;
  vertical-align: baseline;
  padding: 0 0.15em;
  border-radius: 0.2em;
  background: rgba(234, 228, 216, 0.7);
  border: none;
}

.flux-slot-inner {
  width: 100%;
  height: 100%;
  position: relative;
}

.flux-inline-slot .flux-slot-inner {
  display: inline-block;
  min-width: 100%;
  line-height: inherit;
}

.flux-transition {
  position: relative;
  --flux-dur: 220ms;
  --flux-ease: cubic-bezier(0.4, 0, 0.2, 1);
}

.flux-transition .flux-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.flux-transition .flux-layer--sizer {
  position: relative;
  inset: auto;
  width: auto;
  height: auto;
  visibility: hidden;
}

.flux-transition .flux-layer--old {
  z-index: 1;
}

.flux-transition .flux-layer--new {
  z-index: 2;
}

.flux-transition .flux-layer--flash {
  z-index: 3;
}

.flux-transition--fade .flux-layer--old {
  opacity: 1;
}

.flux-transition--fade .flux-layer--new {
  opacity: 0;
}

.flux-transition--fade.is-active .flux-layer--old {
  opacity: 0;
  transition: opacity var(--flux-dur) var(--flux-ease);
}

.flux-transition--fade.is-active .flux-layer--new {
  opacity: 1;
  transition: opacity var(--flux-dur) var(--flux-ease);
}

.flux-transition--wipe .flux-layer--new {
  clip-path: inset(0 100% 0 0);
}

.flux-transition--wipe[data-flux-wipe="right"] .flux-layer--new {
  clip-path: inset(0 0 0 100%);
}

.flux-transition--wipe[data-flux-wipe="up"] .flux-layer--new {
  clip-path: inset(100% 0 0 0);
}

.flux-transition--wipe[data-flux-wipe="down"] .flux-layer--new {
  clip-path: inset(0 0 100% 0);
}

.flux-transition--wipe.is-active .flux-layer--new {
  clip-path: inset(0 0 0 0);
  transition: clip-path var(--flux-dur) var(--flux-ease);
}

.flux-transition--flash .flux-layer--flash {
  background: rgba(255, 241, 200, 0.75);
  opacity: 0;
}

.flux-transition--flash.is-active .flux-layer--flash {
  animation: flux-flash var(--flux-dur) var(--flux-ease);
}

@keyframes flux-flash {
  0% {
    opacity: 0;
  }
  20% {
    opacity: 0.7;
  }
  100% {
    opacity: 0;
  }
}

body[data-debug-slots="1"] .flux-slot,
body[data-debug-slots="1"] .flux-inline-slot {
  outline: 1px dashed rgba(120, 110, 98, 0.55);
  outline-offset: 1px;
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
${styleCss}
`.trim();
}

function buildStyleCss(styles: RenderStyleDefinition[]): string {
  if (!styles.length) return "";
  const blocks: string[] = [];
  for (const style of styles) {
    const cssProps = stylePropsToCss(style.props);
    const entries = Object.entries(cssProps);
    if (!entries.length) continue;
    const body = entries.map(([key, value]) => `${key}: ${value};`).join(" ");
    blocks.push(`.${style.className} { ${body} }`);
  }
  return blocks.join("\n");
}

function stylePropsToCss(props: Record<string, RenderValue>): Record<string, string> {
  const css: Record<string, string> = {};
  const axes: Record<string, string> = {};

  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (key.startsWith("font.axes.")) {
      const axis = key.slice("font.axes.".length);
      axes[axis] = formatStyleValue(key, value);
      continue;
    }
    switch (key) {
      case "font.family":
        css["font-family"] = formatStyleValue(key, value);
        break;
      case "font.size":
        css["font-size"] = formatStyleValue(key, value, "pt");
        break;
      case "font.weight":
        css["font-weight"] = formatStyleValue(key, value);
        break;
      case "font.style":
        css["font-style"] = formatStyleValue(key, value);
        break;
      case "line.height":
        css["line-height"] = formatStyleValue(key, value, "unitless");
        break;
      case "letter.spacing":
        css["letter-spacing"] = formatStyleValue(key, value, "pt");
        break;
      case "text.transform":
        css["text-transform"] = formatStyleValue(key, value);
        break;
      case "text.align":
        css["text-align"] = formatStyleValue(key, value);
        break;
      case "space.before":
        css["margin-top"] = formatStyleValue(key, value, "pt");
        break;
      case "space.after":
        css["margin-bottom"] = formatStyleValue(key, value, "pt");
        break;
      case "space.indent":
        css["text-indent"] = formatStyleValue(key, value, "pt");
        break;
      case "color":
        css.color = formatStyleValue(key, value);
        break;
      case "background":
        css["background"] = formatStyleValue(key, value);
        break;
      case "border":
        css["border"] = formatStyleValue(key, value);
        break;
      case "border.color":
        css["border-color"] = formatStyleValue(key, value);
        break;
      case "border.width":
        css["border-width"] = formatStyleValue(key, value, "pt");
        break;
      case "border.radius":
        css["border-radius"] = formatStyleValue(key, value, "pt");
        break;
      case "padding":
        css["padding"] = formatStyleValue(key, value, "pt");
        break;
      default:
        break;
    }
  }

  const axisEntries = Object.entries(axes);
  if (axisEntries.length) {
    const axisValue = axisEntries
      .map(([axis, value]) => `"${escapeAttr(axis)}" ${value}`)
      .join(", ");
    css["font-variation-settings"] = axisValue;
  }

  return css;
}

function formatStyleValue(
  _key: string,
  value: RenderValue,
  mode: "pt" | "unitless" | "auto" = "auto",
): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (mode === "unitless") return String(value);
    if (mode === "pt") return `${value}pt`;
    return `${value}`;
  }
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "1" : "0";
  if (Array.isArray(value)) return value.map((item) => formatStyleValue(_key, item as RenderValue)).join(" ");
  if (typeof value === "object" && (value as RenderAssetRef).kind === "asset") {
    return (value as RenderAssetRef).name ?? "";
  }
  return String(value ?? "");
}

function buildInlineStyle(inlineProps: Record<string, RenderValue> | undefined): string {
  if (!inlineProps) return "";
  const cssProps = stylePropsToCss(inlineProps);
  const entries = Object.entries(cssProps);
  if (!entries.length) return "";
  const body = entries.map(([key, value]) => `${key}:${value};`).join("");
  return ` style="${escapeAttr(body)}"`;
}

interface FootnoteEntry {
  number: string;
  html: string;
  nodeId: string;
}

interface FootnoteContext {
  items: FootnoteEntry[];
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
  footnotes?: FootnoteContext,
  inlineSlotContext = false,
): string {
  const isInlineKind = isInlineNode(node.kind);
  const childrenInline = inlineContext || isInlineKind || node.kind === "text";
  const attrs = buildAttrs(node, inlineContext);
  const styleAttr = buildInlineStyle(mergeInlineStyles(node, inlineContext));

  const renderChildren = (inline = childrenInline, context = footnotes, slotContext = inlineSlotContext): string =>
    node.children.map((child) => renderNode(child, options, inline, context, slotContext)).join("");

  if (inlineSlotContext && inlineContext && isBlockLike(node.kind) && node.kind !== "slot") {
    return renderChildren(true, footnotes, inlineSlotContext);
  }

  switch (node.kind) {
    case "page": {
      const pageFootnotes: FootnoteContext = { items: [] };
      const pageHtml = node.children
        .map((child) => renderNode(child, options, false, pageFootnotes))
        .join("");
      const footnoteHtml = renderFootnotes(pageFootnotes);
      const className = buildClassName("flux-page", node);
      return `<section class="${className}" ${attrs}${styleAttr}><div class="flux-page-inner">${pageHtml}${footnoteHtml}</div><div class="flux-page-number"></div></section>`;
    }
    case "section":
      return `<section class="${buildClassName("flux-section", node)}" ${attrs}${styleAttr}>${renderChildren()}</section>`;
    case "row":
      return `<div class="${buildClassName("flux-row", node)}" ${attrs}${styleAttr}>${renderChildren()}</div>`;
    case "column":
      return `<div class="${buildClassName("flux-column", node)}" ${attrs}${styleAttr}>${renderChildren()}</div>`;
    case "spacer": {
      const height = resolveNumeric(node.props.size, 12);
      return `<div class="${buildClassName("flux-spacer", node)}" ${attrs} style="height:${height}px;"></div>`;
    }
    case "text": {
      const content = renderTextContent(node.props.content, options.hyphenate);
      const tag = inlineContext ? "span" : "p";
      const variantRaw = resolveString(node.props.variant);
      const variant = variantRaw ? sanitizeClass(variantRaw) : "";
      const variantClass = variant ? ` flux-text-${variant}` : "";
      const className = buildClassName(
        inlineContext ? `flux-text inline${variantClass}` : `flux-text${variantClass}`,
        node,
      );
      return `<${tag} class="${className}" ${attrs}${styleAttr}>${content}${renderChildren()}</${tag}>`;
    }
    case "em":
      return `<em class="${buildClassName("flux-em", node)}" ${attrs}${styleAttr}>${renderInlineContent(node, options)}${renderChildren(true)}</em>`;
    case "strong":
      return `<strong class="${buildClassName("flux-strong", node)}" ${attrs}${styleAttr}>${renderInlineContent(node, options)}${renderChildren(true)}</strong>`;
    case "code":
      return `<code class="${buildClassName("flux-code", node)}" ${attrs}${styleAttr}>${renderInlineCode(node)}${renderChildren(true)}</code>`;
    case "smallcaps":
      return `<span class="${buildClassName("flux-smallcaps", node)}" ${attrs}${styleAttr}>${renderInlineContent(node, options)}${renderChildren(true)}</span>`;
    case "sub":
      return `<sub class="${buildClassName("flux-sub", node)}" ${attrs}${styleAttr}>${renderInlineContent(node, options)}${renderChildren(true)}</sub>`;
    case "sup":
      return `<sup class="${buildClassName("flux-sup", node)}" ${attrs}${styleAttr}>${renderInlineContent(node, options)}${renderChildren(true)}</sup>`;
    case "mark":
      return `<mark class="${buildClassName("flux-mark", node)}" ${attrs}${styleAttr}>${renderInlineContent(node, options)}${renderChildren(true)}</mark>`;
    case "quote":
      return `<q class="${buildClassName("flux-quote", node)}" ${attrs}${styleAttr}>${renderInlineContent(node, options)}${renderChildren(true)}</q>`;
    case "link":
      return renderLink(node, attrs, styleAttr, options, renderChildren(true));
    case "blockquote":
      return `<blockquote class="${buildClassName("flux-blockquote", node)}" ${attrs}${styleAttr}>${renderChildren()}</blockquote>`;
    case "codeblock": {
      const content = renderInlineCode(node);
      return `<pre class="${buildClassName("flux-codeblock", node)}" ${attrs}${styleAttr}><code>${content}${renderChildren(true)}</code></pre>`;
    }
    case "callout": {
      const toneRaw = resolveString(node.props.tone || node.props.variant);
      const tone = toneRaw ? sanitizeClass(toneRaw) : "info";
      const className = buildClassName(`flux-callout flux-callout-${tone}`, node);
      return `<aside class="${className}" ${attrs}${styleAttr}>${renderChildren()}</aside>`;
    }
    case "table":
      return renderTable(node, attrs, styleAttr, options, renderChildren());
    case "ul":
      return `<ul class="${buildClassName("flux-list", node)}" ${attrs}${styleAttr}>${renderChildren()}</ul>`;
    case "ol": {
      const start = resolveNumeric(node.props.start, 1);
      const startAttr = node.props.start != null ? ` start="${start}"` : "";
      return `<ol class="${buildClassName("flux-list", node)}" ${attrs}${styleAttr}${startAttr}>${renderChildren()}</ol>`;
    }
    case "li":
      return `<li class="${buildClassName("flux-list-item", node)}" ${attrs}${styleAttr}>${renderChildren()}</li>`;
    case "hr":
      return `<hr class="${buildClassName("flux-hr", node)}" ${attrs}${styleAttr} />`;
    case "footnote":
      return renderFootnote(node, options, footnotes);
    case "image":
      return renderImage(node, attrs, options, styleAttr);
    case "figure":
      return `<figure class="${buildClassName("flux-figure", node)}" ${attrs}${styleAttr}>${renderFigureMedia(node, options)}${renderChildren()}</figure>`;
    case "grid":
      return renderGrid(node, attrs);
    case "slot":
      return renderSlot(node, attrs, false, renderChildren(false), options.slots, styleAttr);
    case "inline_slot":
      return renderSlot(node, attrs, true, renderChildren(true, footnotes, true), options.slots, styleAttr);
    default:
      return `<div class="${buildClassName("flux-node", node)}" ${attrs}${styleAttr}>${renderChildren()}</div>`;
  }
}

function isInlineNode(kind: string): boolean {
  return (
    kind === "em" ||
    kind === "strong" ||
    kind === "code" ||
    kind === "smallcaps" ||
    kind === "sub" ||
    kind === "sup" ||
    kind === "mark" ||
    kind === "link" ||
    kind === "quote" ||
    kind === "footnote"
  );
}

function isBlockLike(kind: string): boolean {
  return (
    kind === "page" ||
    kind === "section" ||
    kind === "row" ||
    kind === "column" ||
    kind === "blockquote" ||
    kind === "codeblock" ||
    kind === "callout" ||
    kind === "table" ||
    kind === "ul" ||
    kind === "ol" ||
    kind === "li" ||
    kind === "figure" ||
    kind === "grid" ||
    kind === "slot"
  );
}

function buildClassName(base: string, node: RenderNodeIR): string {
  const styleClass = node.style?.className ? ` ${escapeAttr(node.style.className)}` : "";
  return `${base}${styleClass}`;
}

function mergeInlineStyles(node: RenderNodeIR, inlineContext: boolean): Record<string, RenderValue> | undefined {
  const merged: Record<string, RenderValue> = {};
  if (node.style?.inline) {
    Object.assign(merged, node.style.inline);
  }
  if (node.kind === "text" || inlineContext) {
    const align = resolveString(node.props.align);
    if (align) {
      merged["text.align"] = align;
    }
  }
  return Object.keys(merged).length ? merged : undefined;
}

function renderInlineContent(node: RenderNodeIR, options: { hyphenate: boolean }): string {
  return renderTextContent(node.props.content, options.hyphenate);
}

function renderInlineCode(node: RenderNodeIR): string {
  const raw = resolveString(node.props.content);
  return raw ? escapeHtml(raw) : "";
}

function renderLink(
  node: RenderNodeIR,
  attrs: string,
  styleAttr: string,
  options: { hyphenate: boolean },
  childHtml: string,
): string {
  const rawHref = resolveString(node.props.href || node.props.url || node.props.to);
  const href = sanitizeHref(rawHref);
  const content = renderInlineContent(node, options) + childHtml;
  return `<a class="${buildClassName("flux-link", node)}" ${attrs}${styleAttr} href="${escapeAttr(href)}" rel="noopener noreferrer">${content}</a>`;
}

function sanitizeHref(href: string): string {
  if (!href) return "#";
  const trimmed = href.trim();
  if (trimmed.startsWith("#")) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const url = new URL(trimmed, "https://example.invalid");
    const protocol = url.protocol.replace(":", "");
    if (protocol === "http" || protocol === "https" || protocol === "mailto" || protocol === "tel") {
      return trimmed;
    }
  } catch {
    return "#";
  }
  return "#";
}

function renderTable(
  node: RenderNodeIR,
  attrs: string,
  styleAttr: string,
  options: { hyphenate: boolean },
  childHtml?: string,
): string {
  const rowsValue = node.props.rows ?? node.props.data;
  const rows = Array.isArray(rowsValue) ? rowsValue : [];
  const header = Boolean(node.props.header);
  const tableRows = rows
    .map((row, rowIndex) => {
      const cells = Array.isArray(row) ? row : [row];
      const tag = header && rowIndex === 0 ? "th" : "td";
      const cellsHtml = cells
        .map((cell) => `<${tag}>${escapeHtml(resolveString(cell as RenderValue))}</${tag}>`)
        .join("");
      return `<tr>${cellsHtml}</tr>`;
    })
    .join("");
  const tableHtml = `<table class="${buildClassName("flux-table", node)}" ${attrs}${styleAttr}>${tableRows}</table>`;
  if (childHtml) {
    return `${tableHtml}${childHtml}`;
  }
  return tableHtml;
}

function renderFootnote(
  node: RenderNodeIR,
  options: {
    hyphenate: boolean;
    slots: Record<string, string>;
    assetUrl?: (assetId: string) => string;
    rawUrl?: (raw: string) => string;
  },
  footnotes?: FootnoteContext,
): string {
  const explicit = resolveString(node.props.number || node.props.index || node.props.n);
  const counter = node.counters?.footnote;
  const number = explicit || (counter != null ? String(counter) : String((footnotes?.items.length ?? 0) + 1));
  const content =
    renderInlineContent(node, options) +
    node.children.map((child) => renderNode(child, options, true, undefined)).join("");

  if (footnotes) {
    footnotes.items.push({ number, html: content, nodeId: node.nodeId });
  }
  return `<sup class="flux-footnote-ref" data-footnote="${escapeAttr(number)}">${escapeHtml(number)}</sup>`;
}

function renderFootnotes(context: FootnoteContext): string {
  if (!context.items.length) return "";
  const items = context.items
    .map((item) => `<li data-footnote="${escapeAttr(item.number)}">${item.html}</li>`)
    .join("");
  return `<section class="flux-footnotes"><ol>${items}</ol></section>`;
}

function renderSlot(
  node: RenderNodeIR,
  attrs: string,
  inline: boolean,
  childHtml: string,
  slots: Record<string, string>,
  styleAttr = "",
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
  const styleClass = node.style?.className ? ` ${escapeAttr(node.style.className)}` : "";
  const className = inline
    ? `flux-inline-slot${fitClass}${styleClass}`
    : `flux-slot${fitClass}${styleClass}`;
  const innerTag = inline ? "span" : "div";
  return `<${inline ? "span" : "div"} class="${className}" ${attrs}${styleAttr}${style}><${innerTag} class="flux-slot-inner" data-flux-slot-inner>${childHtml}</${innerTag}></${inline ? "span" : "div"}>`;
}

function renderImage(
  node: RenderNodeIR,
  attrs: string,
  options: { assetUrl?: (assetId: string) => string; rawUrl?: (raw: string) => string },
  styleAttr = "",
): string {
  const { src, assetId, raw } = resolveImageSource(node.props, options);
  const resolvedSrc = resolveImageUrl(src, assetId, raw, options.assetUrl, options.rawUrl);
  const extraAttrs = [
    assetId ? `data-flux-asset-id="${escapeAttr(assetId)}"` : "",
    raw ? `data-flux-src="${escapeAttr(raw)}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const className = buildClassName("flux-image", node);
  return `<img class="${className}" ${attrs}${styleAttr} ${extraAttrs} src="${escapeAttr(resolvedSrc)}" alt="${escapeAttr(resolveString(node.props.alt))}">`;
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
  const refresh = node.refresh?.kind ?? "never";
  const isInline = inline || node.kind === "inline_slot";
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
  if (isInline) {
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

function sanitizeClass(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

function transparentPixel(): string {
  return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
}
