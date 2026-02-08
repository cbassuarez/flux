export const FLUX_TAGLINE = "procedurally evolving documents";
const VERSION_FALLBACK = "0.0.0";
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