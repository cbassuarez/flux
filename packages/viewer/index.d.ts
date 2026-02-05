import type { RenderDocumentIR } from "@flux-lang/core";
import type { RenderHtmlOptions, RenderHtmlResult } from "@flux-lang/render-html";

export interface ViewerServerOptions {
  docPath: string;
  port?: number;
  host?: string;
  docstepMs?: number;
  timeRate?: number;
  seed?: number;
  allowNet?: string[];
  docstepStart?: number;
  advanceTime?: boolean;
  editorDist?: string;
}

export interface ViewerServer {
  port: number;
  url: string;
  close(): Promise<void>;
}

export function startViewerServer(options: ViewerServerOptions): Promise<ViewerServer>;

export function noCacheHeaders(extra?: Record<string, string>): Record<string, string>;

export function getViewerJs(): string;

export function advanceViewerRuntime(
  runtime: any,
  renderOptions: RenderHtmlOptions | undefined,
  advanceTime: boolean,
  dtSeconds: number,
  timeRate: number,
): { ir: RenderDocumentIR; render: RenderHtmlResult };
