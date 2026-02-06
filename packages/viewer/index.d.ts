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
  buildId?: string | null;
  editorDist?: string | null;
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

export const VIEWER_VERSION: string;

export function computeBuildId(dir: string | null | undefined, indexPath: string | null | undefined): Promise<string | null>;

export interface EditorDistResolution {
  dir: string | null;
  indexPath: string | null;
  source: "flag" | "env" | "embedded" | "missing";
  reason?: string;
  tried?: string[];
}

export interface ResolveEditorDistOptions {
  editorDist?: string;
  env?: NodeJS.ProcessEnv;
  embeddedDir?: string;
  fsImpl?: Pick<typeof import("node:fs"), "stat" | "access">;
}

export function resolveEditorDist(options?: ResolveEditorDistOptions): Promise<EditorDistResolution>;

export function defaultEmbeddedDir(): string;
