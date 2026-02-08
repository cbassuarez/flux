export type SelfUpdateChannel = "stable" | "latest" | "canary";

export function pickVersionFromDistTags(channel: SelfUpdateChannel, distTags: Record<string, string>): string {
  if (channel === "stable") {
    const version = distTags.stable ?? distTags.latest;
    if (!version) throw new Error("Missing stable dist-tag and latest fallback.");
    if (/-canary\./i.test(version)) throw new Error(`Stable dist-tag resolved to canary version ${version}.`);
    return version;
  }
  if (channel === "latest") {
    const version = distTags.latest;
    if (!version) throw new Error("Missing latest dist-tag.");
    return version;
  }
  const version = distTags.canary;
  if (!version) throw new Error("Missing canary dist-tag.");
  return version;
}

export function assertAlignedVersions(versions: Record<string, string>): string {
  const unique = new Set(Object.values(versions));
  if (unique.size > 1) {
    throw new Error(`Self-update packages resolved to mismatched versions: ${Array.from(unique).join(", ")}`);
  }
  return Array.from(unique)[0];
}
