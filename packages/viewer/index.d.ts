import type { RenderDocumentIR } from "@flux-lang/core";
import type { RenderHtmlOptions, RenderHtmlResult } from "@flux-lang/render-html";

export interface ViewerServerOptions {
  docPath: string;
  port?: number;
  host?: string;
  docstepMs?: number;
  seed?: number;
  allowNet?: string[];
  docstepStart?: number;
  advanceTime?: boolean;
}

export interface ViewerServer {
  port: number;
  url: string;
  close(): Promise<void>;
}

export function startViewerServer(options: ViewerServerOptions): Promise<ViewerServer>;

export function advanceViewerRuntime(
  runtime: any,
  renderOptions: RenderHtmlOptions | undefined,
  advanceTime: boolean,
  dtSeconds: number,
): { ir: RenderDocumentIR; render: RenderHtmlResult };
