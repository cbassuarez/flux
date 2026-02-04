export interface TypesetterPdfOptions {
  baseUrl?: string;
  timeoutMs?: number;
  preferCssPageSize?: boolean;
  allowFile?: boolean;
}

export interface TypesetterBackend {
  name: string;
  pdf(html: string, css: string, options?: TypesetterPdfOptions): Promise<Uint8Array>;
  paginate?: (html: string, css: string, options?: TypesetterPdfOptions) => Promise<string>;
}

export function createTypesetterBackend(): TypesetterBackend;
