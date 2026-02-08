import { bumpPatch, parseBaseVersion, writeVersionJson } from "./version.js";
import { syncVersions } from "./syncVersions.js";

async function main(): Promise<void> {
  const baseVersion = await parseBaseVersion();
  const nextVersion = bumpPatch(baseVersion);
  await writeVersionJson({ baseVersion: nextVersion, version: nextVersion, channel: "stable" });
  await syncVersions(nextVersion);
  // eslint-disable-next-line no-console
  console.log(`[release] bumped base version ${baseVersion} -> ${nextVersion}`);
}

void main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.message ?? err);
  process.exit(1);
});
