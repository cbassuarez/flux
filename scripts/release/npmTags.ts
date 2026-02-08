import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getPublishablePackages } from "./workspaces.js";

const execFileAsync = promisify(execFile);

export type DistTagChannel = "stable" | "canary";

export async function applyDistTags(channel: DistTagChannel, version: string, packages?: string[]): Promise<void> {
  const publishable = packages ?? (await getPublishablePackages()).map((pkg) => pkg.name);
  const tags = channel === "stable" ? ["latest", "stable"] : ["canary"];

  for (const pkg of publishable) {
    for (const tag of tags) {
      // eslint-disable-next-line no-console
      console.log(`[dist-tag] npm dist-tag add ${pkg}@${version} ${tag}`);
      await execFileAsync("npm", ["dist-tag", "add", `${pkg}@${version}`, tag], {
        env: { ...process.env, NODE_AUTH_TOKEN: process.env.NODE_AUTH_TOKEN ?? process.env.NPM_TOKEN },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[dist-tag] applied ${tags.join(", ")} for ${version} to ${publishable.length} packages`);
}
