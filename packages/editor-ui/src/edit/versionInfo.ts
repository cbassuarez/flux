import { coerceVersionInfo, type FluxVersionInfo } from "@flux-lang/brand";

declare const __FLUX_VERSION_INFO__: Partial<FluxVersionInfo> | undefined;

type GetFluxVersionInfoOptions = {
  fetchImpl?: typeof fetch;
  dev?: boolean;
  now?: () => number;
  apiPath?: string;
};

function readInjectedVersionInfo(): FluxVersionInfo | null {
  if (typeof __FLUX_VERSION_INFO__ === "undefined" || !__FLUX_VERSION_INFO__?.version) {
    return null;
  }
  return coerceVersionInfo(__FLUX_VERSION_INFO__);
}

async function fetchVersionInfo(
  fetchImpl: typeof fetch,
  path: string,
): Promise<FluxVersionInfo> {
  const response = await fetchImpl(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Version fetch failed (${response.status})`);
  }
  const payload = (await response.json()) as Partial<FluxVersionInfo>;
  return coerceVersionInfo(payload);
}

export async function getFluxVersionInfo(options: GetFluxVersionInfoOptions = {}): Promise<FluxVersionInfo> {
  const injected = readInjectedVersionInfo();
  const isDev = options.dev ?? import.meta.env.DEV;
  const now = options.now ?? Date.now;
  const apiPath = options.apiPath ?? "/api/version";
  const fetchImpl = options.fetchImpl ?? (typeof fetch === "function" ? fetch.bind(globalThis) : undefined);

  if (!isDev && injected) {
    return injected;
  }

  if (fetchImpl) {
    const path = isDev ? `${apiPath}?t=${now()}` : apiPath;
    try {
      return await fetchVersionInfo(fetchImpl, path);
    } catch {
      if (injected) return injected;
    }
  }

  if (injected) {
    return injected;
  }

  return coerceVersionInfo({ version: "0.0.0" });
}
