export type EditState = {
  title?: string;
  path?: string;
  diagnostics?: unknown;
  capabilities?: Record<string, unknown>;
  previewPath?: string;
  outline?: unknown;
  assets?: unknown;
  assetsBanks?: unknown;
  [key: string]: unknown;
};

export type TransformRequest = {
  op: string;
  args: Record<string, unknown>;
  file?: string;
  clientRevision?: number;
  writeId?: string;
};

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export class RequestTimeoutError extends Error {
  status: number;

  constructor(message = "Request timed out") {
    super(message);
    this.status = 408;
  }
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {})
    }
  });
  const body = await parseBody(response);
  if (!response.ok) {
    const message =
      (typeof body === "object" && body && "message" in body && typeof (body as any).message === "string"
        ? (body as any).message
        : typeof body === "string" && body
          ? body
          : `Request failed (${response.status})`);
    throw new ApiError(response.status, message, body);
  }
  return body as T;
}

export async function fetchEditState(): Promise<EditState> {
  return fetchJson<EditState>(withFileParam("/api/edit/state"));
}

export async function fetchEditSource(): Promise<{
  ok?: boolean;
  source?: string;
  diagnostics?: unknown;
  revision?: number;
  lastValidRevision?: number;
  docPath?: string;
}> {
  return fetchJson(withFileParam("/api/edit/source"));
}

export async function fetchEditOutline(): Promise<unknown | null> {
  try {
    return await fetchJson<unknown>(withFileParam("/api/edit/outline"));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function fetchEditNode(id: string): Promise<unknown> {
  const url = withFileParam("/api/edit/node");
  const fullUrl = url.includes("?") ? `${url}&id=${encodeURIComponent(id)}` : `${url}?id=${encodeURIComponent(id)}`;
  return fetchJson<unknown>(fullUrl);
}

export async function postTransform(request: TransformRequest): Promise<unknown> {
  const timeoutMs = 9000;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchJson<unknown>(withFileParam("/api/edit/transform"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request),
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new RequestTimeoutError("Transform request timed out");
    }
    if ((error as { name?: string }).name === "AbortError") {
      throw new RequestTimeoutError("Transform request timed out");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function getFileParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("file");
}

function withFileParam(path: string): string {
  const file = getFileParam();
  if (!file || typeof window === "undefined") return path;
  const url = new URL(path, window.location.origin);
  url.searchParams.set("file", file);
  return `${url.pathname}${url.search}`;
}
