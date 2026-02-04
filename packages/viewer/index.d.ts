export interface ViewerServerOptions {
  docPath: string;
  port?: number;
  docstepMs?: number;
  seed?: number;
  allowNet?: string[];
  docstepStart?: number;
}

export interface ViewerServer {
  port: number;
  url: string;
  close(): Promise<void>;
}

export function startViewerServer(options: ViewerServerOptions): Promise<ViewerServer>;
