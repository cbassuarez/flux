import { formatCanaryVersion, parseBaseVersion } from "./version.js";
import { syncVersions } from "./syncVersions.js";

function resolveSha(): string {
  const arg = process.argv.find((entry) => entry.startsWith("--sha="));
  if (arg) return arg.slice("--sha=".length);
  return process.env.GITHUB_SHA ?? process.env.SHA ?? "";
}

async function main(): Promise<void> {
  const sha = resolveSha();
  if (!sha) throw new Error("Missing SHA for canary publish.");
  const baseVersion = await parseBaseVersion();
  const canaryVersion = formatCanaryVersion(baseVersion, sha);
  await syncVersions(canaryVersion);
  // eslint-disable-next-line no-console
  console.log(`[release] synced canary versions to ${canaryVersion}`);
}

void main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.message ?? err);
  process.exit(1);
});
