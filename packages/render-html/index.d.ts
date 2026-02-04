import type { RenderDocumentIR } from "@flux-lang/core";

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

export function renderHtml(doc: RenderDocumentIR, options?: RenderHtmlOptions): RenderHtmlResult;

export function renderSlotMap(doc: RenderDocumentIR, options?: RenderHtmlOptions): Record<string, string>;
