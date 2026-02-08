export const FLUX_TAGLINE = "procedurally evolving documents";

const VERSION_FALLBACK = "0.0.0";

export type FluxChannel = "stable" | "canary";

export type FluxVersionInfo = {
  version: string;
  channel?: FluxChannel;
  build?: string;
  sha?: string;
  tagline: string;
};

function normalizeFluxVersion(version: string | undefined): string {
  const trimmed = (version ?? "").trim();
  const withoutPrefix = trimmed.replace(/^v+/i, "");
  return withoutPrefix.length > 0 ? withoutPrefix : VERSION_FALLBACK;
}

export function formatFluxVersion(version: string): string {
  return `v${normalizeFluxVersion(version)}`;
}

export function coerceVersionInfo(input: Partial<FluxVersionInfo>): FluxVersionInfo {
  const version = normalizeFluxVersion(input.version);
  const channel = input.channel;
  const build = input.build;
  const sha = input.sha;

  return {
    version,
    ...(channel ? { channel } : {}),
    ...(build ? { build } : {}),
    ...(sha ? { sha } : {}),
    tagline: FLUX_TAGLINE,
  };
}
