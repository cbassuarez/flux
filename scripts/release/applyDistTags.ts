import { applyDistTags } from "./npmTags.js";

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((entry) => entry.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  const channel = getArg("channel") as "stable" | "canary" | undefined;
  const version = getArg("version");
  if (!channel || (channel !== "stable" && channel !== "canary")) {
    throw new Error("Provide --channel=stable|canary.");
  }
  if (!version) throw new Error("Provide --version=<version>.");
  await applyDistTags(channel, version);
}

void main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.message ?? err);
  process.exit(1);
});
