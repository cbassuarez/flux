export const FLUX_TAGLINE = "procedurally evolving documents";

const VERSION_FALLBACK = "0.0.0";

export {
  badgeIds,
  badgeKinds,
  kinds,
  BADGE_FALLBACK_VALUE,
  BADGE_ACCENTS,
  BADGE_SIZE_TOKENS,
  BADGE_THEME_TOKENS,
  formatBadgeVersion,
  packageNameToSlug,
  normalizeBadgeValue,
} from "./badge-shared.js";
export type { BadgeKind, BadgeSize, BadgeTheme, BadgeReleaseChannel } from "./badge-shared.js";

export {
  Badge,
  NpmBadge,
  ChannelBadge,
  CiBadge,
  LicenseBadge,
  DocsBadge,
  DiscordBadge,
  SecurityBadge,
  MaintainedBadge,
  fallbackBadgeValue,
} from "./badges.js";
export type {
  BadgeProps,
  NpmBadgeProps,
  ChannelBadgeProps,
  CiBadgeProps,
  LicenseBadgeProps,
  DocsBadgeProps,
  DiscordBadgeProps,
  SecurityBadgeProps,
  MaintainedBadgeProps,
} from "./badges.js";

export { renderBadgeSvg } from "./badge-svg.js";
export type { BadgeSvgTheme, BadgeSvgOptions } from "./badge-svg.js";

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
