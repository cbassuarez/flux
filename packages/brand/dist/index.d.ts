export declare const FLUX_TAGLINE = "procedurally evolving documents";
export { badgeIds, badgeKinds, kinds, BADGE_FALLBACK_VALUE, BADGE_ACCENTS, BADGE_SIZE_TOKENS, BADGE_THEME_TOKENS, formatBadgeVersion, packageNameToSlug, normalizeBadgeValue, } from "./badge-shared.js";
export type { BadgeKind, BadgeSize, BadgeTheme, BadgeReleaseChannel } from "./badge-shared.js";
export { Badge, NpmBadge, ChannelBadge, CiBadge, LicenseBadge, DocsBadge, DiscordBadge, SecurityBadge, MaintainedBadge, fallbackBadgeValue, } from "./badges.js";
export type { BadgeProps, NpmBadgeProps, ChannelBadgeProps, CiBadgeProps, LicenseBadgeProps, DocsBadgeProps, DiscordBadgeProps, SecurityBadgeProps, MaintainedBadgeProps, } from "./badges.js";
export { FLUX_BADGE_BASE_CLASSES, FluxBadge } from "./flux-badge.js";
export type { FluxBadgeProps } from "./flux-badge.js";
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
export declare function formatFluxVersion(version: string): string;
export declare function coerceVersionInfo(input: Partial<FluxVersionInfo>): FluxVersionInfo;
//# sourceMappingURL=index.d.ts.map