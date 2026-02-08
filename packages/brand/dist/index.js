export const FLUX_TAGLINE = "procedurally evolving documents";
const VERSION_FALLBACK = "0.0.0";
export { badgeIds, badgeKinds, kinds, BADGE_FALLBACK_VALUE, BADGE_ACCENTS, BADGE_SIZE_TOKENS, BADGE_THEME_TOKENS, formatBadgeVersion, packageNameToSlug, normalizeBadgeValue, } from "./badge-shared.js";
export { Badge, NpmBadge, ChannelBadge, CiBadge, LicenseBadge, DocsBadge, DiscordBadge, SecurityBadge, MaintainedBadge, fallbackBadgeValue, } from "./badges.js";
export { renderBadgeSvg } from "./badge-svg.js";
function normalizeFluxVersion(version) {
    const trimmed = (version ?? "").trim();
    const withoutPrefix = trimmed.replace(/^v+/i, "");
    return withoutPrefix.length > 0 ? withoutPrefix : VERSION_FALLBACK;
}
export function formatFluxVersion(version) {
    return `v${normalizeFluxVersion(version)}`;
}
export function coerceVersionInfo(input) {
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
//# sourceMappingURL=index.js.map