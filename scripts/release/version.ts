import fs from "node:fs/promises";
import path from "node:path";

const VERSION_PATH = path.resolve(process.cwd(), "version.json");

export type ReleaseChannel = "stable" | "canary";

export function isCanaryVersion(version: string): boolean {
  return /-canary\./i.test(version);
}

export function channelFromVersion(version: string): ReleaseChannel {
  return isCanaryVersion(version) ? "canary" : "stable";
}

export function normalizeVersion(raw: string): string {
  return raw.trim().replace(/^v+/i, "");
}

export function versionFromTag(tag: string): string {
  return normalizeVersion(tag);
}

export function formatCanaryVersion(baseVersion: string, sha: string): string {
  const trimmedSha = sha.trim().slice(0, 7);
  if (!trimmedSha) throw new Error("Missing SHA for canary version.");
  return `${baseVersion}-canary.${trimmedSha}`;
}

export function bumpPatch(baseVersion: string): string {
  const normalized = normalizeVersion(baseVersion);
  const match = /^([0-9]+)\.([0-9]+)\.([0-9]+)$/.exec(normalized);
  if (!match) throw new Error(`Invalid base version '${baseVersion}'. Expected X.Y.Z.`);
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  return `${major}.${minor}.${patch + 1}`;
}

export async function parseBaseVersion(): Promise<string> {
  const raw = await fs.readFile(VERSION_PATH, "utf8");
  const parsed = JSON.parse(raw) as { baseVersion?: string; version?: string };
  const baseVersion = parsed.baseVersion ?? parsed.version;
  if (!baseVersion) throw new Error("version.json is missing baseVersion.");
  return normalizeVersion(baseVersion);
}

export async function readVersionJson(): Promise<{ baseVersion: string; version?: string; channel?: string }>{
  const raw = await fs.readFile(VERSION_PATH, "utf8");
  const parsed = JSON.parse(raw) as { baseVersion?: string; version?: string; channel?: string };
  const baseVersion = parsed.baseVersion ?? parsed.version;
  if (!baseVersion) throw new Error("version.json is missing baseVersion.");
  return { baseVersion: normalizeVersion(baseVersion), version: parsed.version, channel: parsed.channel };
}

export async function writeVersionJson(next: { baseVersion: string; version?: string; channel?: string }): Promise<void> {
  const payload = {
    baseVersion: normalizeVersion(next.baseVersion),
    version: normalizeVersion(next.version ?? next.baseVersion),
    ...(next.channel ? { channel: next.channel } : {}),
  };
  await fs.writeFile(VERSION_PATH, `${JSON.stringify(payload, null, 2)}\n`);
}
