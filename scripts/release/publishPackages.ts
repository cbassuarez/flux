import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getPublishablePackages } from "./workspaces.js";

const execFileAsync = promisify(execFile);

function parseTag(): string {
  const arg = process.argv.find((entry) => entry.startsWith("--tag="));
  return arg ? arg.slice("--tag=".length) : "latest";
}

async function isPublished(name: string, version: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("npm", ["view", `${name}@${version}`, "version"], {
      env: { ...process.env, npm_config_update_notifier: "false" },
    });
    return stdout.trim() === version;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const tag = parseTag();
  const packages = await getPublishablePackages();

  for (const pkg of packages) {
    if (!pkg.version) throw new Error(`Missing version for ${pkg.name}`);
    const published = await isPublished(pkg.name, pkg.version);
    if (published) {
      // eslint-disable-next-line no-console
      console.log(`[publish] skip ${pkg.name}@${pkg.version} (already published)`);
      continue;
    }
    // eslint-disable-next-line no-console
    console.log(`[publish] pnpm --filter ${pkg.name} publish --tag ${tag}`);
    await execFileAsync("pnpm", ["--filter", pkg.name, "publish", "--tag", tag, "--access", "public", "--no-git-checks"], {
      env: { ...process.env, npm_config_update_notifier: "false" },
    });
  }
}

void main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.message ?? err);
  process.exit(1);
});
