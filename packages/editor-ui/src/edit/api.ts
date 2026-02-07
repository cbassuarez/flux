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
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
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
  const file = getFileParam();
  const body = file && !request.file ? { ...request, file } : request;
  try {
    return await fetchJson<unknown>(withFileParam("/api/edit/transform"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
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

const FILE_STORAGE_KEY = "flux.edit.file";

function readFileFromQueryString(query: string | null | undefined): string | null {
  if (!query) return null;
  const trimmed = query.startsWith("?") ? query.slice(1) : query;
  return new URLSearchParams(trimmed).get("file");
}

export function resolveFileParam({
  search,
  hash,
  referrer,
  parentSearch,
  stored
}: {
  search?: string | null;
  hash?: string | null;
  referrer?: string | null;
  parentSearch?: string | null;
  stored?: string | null;
}): string | null {
  const fromSearch = readFileFromQueryString(search);
  if (fromSearch) return fromSearch;

  if (hash && hash.includes("?")) {
    const queryIndex = hash.indexOf("?");
    const fromHash = readFileFromQueryString(hash.slice(queryIndex + 1));
    if (fromHash) return fromHash;
  }

  if (referrer) {
    try {
      const referrerUrl = new URL(referrer);
      const fromReferrer = readFileFromQueryString(referrerUrl.search);
      if (fromReferrer) return fromReferrer;
    } catch {
      // ignore invalid referrer
    }
  }

  const fromParent = readFileFromQueryString(parentSearch);
  if (fromParent) return fromParent;

  return stored ?? null;
}

function getFileParam(): string | null {
  if (typeof window === "undefined") return null;
  const search = window.location.search;
  const hash = window.location.hash;
  let referrer: string | null = null;
  if (typeof document !== "undefined") {
    try {
      referrer = document.referrer;
    } catch {
      referrer = null;
    }
  }
  let parentSearch: string | null = null;
  try {
    if (window.parent && window.parent !== window) {
      parentSearch = window.parent.location.search;
    }
  } catch {
    parentSearch = null;
  }
  let stored: string | null = null;
  try {
    stored = window.sessionStorage.getItem(FILE_STORAGE_KEY) ?? window.localStorage.getItem(FILE_STORAGE_KEY);
  } catch {
    stored = null;
  }
  const file = resolveFileParam({ search, hash, referrer, parentSearch, stored });
  if (file) {
    try {
      window.sessionStorage.setItem(FILE_STORAGE_KEY, file);
      window.localStorage.setItem(FILE_STORAGE_KEY, file);
    } catch {
      // ignore storage errors
    }
  }
  return file;
}

function withFileParam(path: string): string {
  const file = getFileParam();
  if (!file || typeof window === "undefined") return path;
  const url = new URL(path, window.location.origin);
  url.searchParams.set("file", file);
  return `${url.pathname}${url.search}`;
}
