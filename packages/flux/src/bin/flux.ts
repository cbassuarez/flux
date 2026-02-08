#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import envPaths from "env-paths";
import semver from "semver";
import { assertAlignedVersions, pickVersionFromDistTags, type SelfUpdateChannel } from "../self-update.js";

type Channel = SelfUpdateChannel;

type ResolvedVersions = Record<string, string>;
type ChannelCache = Partial<Record<Channel, ResolvedVersions>>;

interface LauncherConfig {
  channel: Channel;
  pinnedVersion?: string;
  lastResolved?: ChannelCache | Partial<Record<Channel, string>>;
  lastCheckMs?: number;
  autoUpdate?: boolean;
  ttlMinutes?: number;
}

interface ResolvedCli {
  version: string;
  binPath: string;
}

const paths = envPaths("flux", { suffix: "" });
const CONFIG_PATH = path.join(paths.config, "config.json");
const CACHE_ROOT = path.join(paths.cache, "cli");
const LOCK_PATH = path.join(paths.cache, "install.lock");
const DEFAULT_CHANNEL: Channel = "canary";
const DEFAULT_TTL_MINUTES = 10;
const SELF_UPDATE_PACKAGES = ["@flux-lang/cli", "@flux-lang/viewer"];
const FIX_HINT = "Re-run online or set a pinned version via `flux self pin <version>`.";

async function readConfig(): Promise<LauncherConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const cfg = JSON.parse(raw) as LauncherConfig;
    return {
      channel: cfg.channel ?? DEFAULT_CHANNEL,
      pinnedVersion: cfg.pinnedVersion,
      lastResolved: cfg.lastResolved ?? {},
      lastCheckMs: cfg.lastCheckMs,
      autoUpdate: cfg.autoUpdate ?? true,
      ttlMinutes: cfg.ttlMinutes ?? DEFAULT_TTL_MINUTES,
    };
  } catch {
    return { channel: DEFAULT_CHANNEL, autoUpdate: true, ttlMinutes: DEFAULT_TTL_MINUTES };
  }
}

async function writeConfig(cfg: LauncherConfig): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function normalizeLastResolved(input: LauncherConfig["lastResolved"]): ChannelCache {
  if (!input) return {};
  const normalized: ChannelCache = {};
  for (const [channel, value] of Object.entries(input)) {
    if (!value) continue;
    if (typeof value === "string") {
      normalized[channel as Channel] = { "@flux-lang/cli": value };
    } else {
      normalized[channel as Channel] = value as ResolvedVersions;
    }
  }
  return normalized;
}

function parseVerboseFlag(args: string[]): { verbose: boolean; rest: string[] } {
  let verbose = false;
  const rest: string[] = [];
  for (const arg of args) {
    if (arg === "--verbose" || arg === "--verbose=true") {
      verbose = true;
    } else {
      rest.push(arg);
    }
  }
  return { verbose, rest };
}

function parseArgs(argv: string[]): {
  channel?: Channel;
  pin?: string | null;
  selfCmd?: string;
  passthrough: string[];
  verbose: boolean;
} {
  const passthrough: string[] = [];
  let channel: Channel | undefined;
  let pin: string | null | undefined;
  let selfCmd: string | undefined;
  let verbose = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--channel") {
      channel = (argv[i + 1] as Channel) ?? channel;
      i += 1;
      continue;
    }
    if (arg.startsWith("--channel=")) {
      channel = arg.slice("--channel=".length) as Channel;
      continue;
    }
    if (arg === "--verbose" || arg === "--verbose=true") {
      verbose = true;
      continue;
    }
    if (arg === "self") {
      selfCmd = argv[i + 1];
      passthrough.push(...argv.slice(i + 2));
      break;
    }
    if (arg === "--pin") {
      pin = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg.startsWith("--pin=")) {
      pin = arg.slice("--pin=".length);
      continue;
    }
    if (!arg.startsWith("--")) {
      passthrough.push(arg);
    } else {
      passthrough.push(arg);
    }
  }
  return { channel, pin, selfCmd, passthrough, verbose };
}

async function loadPackageJsonFrom(dir: string): Promise<any | null> {
  try {
    const data = await fs.readFile(path.join(dir, "package.json"), "utf8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function cliPackageDir(installDir: string): string {
  return path.join(installDir, "node_modules", "@flux-lang", "cli");
}

function packageInstallDir(installDir: string, pkgName: string): string {
  const scoped = pkgName.startsWith("@") ? pkgName.slice(1).split("/") : [pkgName];
  return path.join(installDir, "node_modules", ...scoped);
}

function npmRegistryUrl(pkgName: string): string {
  return `https://registry.npmjs.org/${encodeURIComponent(pkgName)}`;
}

async function fetchDistTags(pkgName: string): Promise<Record<string, string>> {
  const res = await fetch(npmRegistryUrl(pkgName), {
    headers: { Accept: "application/vnd.npm.install-v1+json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch dist-tags for ${pkgName} (${res.status})`);
  }
  const data = (await res.json()) as { "dist-tags"?: Record<string, string> };
  return data["dist-tags"] ?? {};
}


async function hasInstalled(version: string): Promise<boolean> {
  const installDir = path.join(CACHE_ROOT, version);
  const pkg = await loadPackageJsonFrom(cliPackageDir(installDir));
  if (!pkg?.bin?.flux || pkg.version !== version) return false;
  for (const name of SELF_UPDATE_PACKAGES) {
    const pkgJson = await loadPackageJsonFrom(packageInstallDir(installDir, name));
    if (pkgJson?.version !== version) return false;
  }
  return true;
}

async function resolveInstalledBin(version: string): Promise<string | null> {
  const installDir = path.join(CACHE_ROOT, version);
  const pkg = await loadPackageJsonFrom(cliPackageDir(installDir));
  if (pkg?.version === version && pkg.bin?.flux) {
    return path.join(cliPackageDir(installDir), pkg.bin.flux);
  }
  return null;
}

async function newestCachedVersion(): Promise<string | null> {
  try {
    const entries = await fs.readdir(CACHE_ROOT, { withFileTypes: true });
    const versions = entries.filter((e) => e.isDirectory()).map((e) => e.name).filter((v) => semver.valid(v));
    if (!versions.length) return null;
    versions.sort((a, b) => semver.rcompare(a, b));
    return versions[0];
  } catch {
    return null;
  }
}

async function ensureInstalled(version: string): Promise<ResolvedCli> {
  const installDir = path.join(CACHE_ROOT, version);
  const pkg = await loadPackageJsonFrom(cliPackageDir(installDir));
  if (pkg?.version === version && pkg.bin && pkg.bin.flux && (await hasInstalled(version))) {
    return { version, binPath: path.join(cliPackageDir(installDir), pkg.bin.flux) };
  }

  await withLock(async () => {
    await fs.mkdir(installDir, { recursive: true });
    const packages = SELF_UPDATE_PACKAGES.map((name) => `${name}@${version}`);
    await withTempNpmUserConfig(async (userConfigPath) => {
      const args = [
        "install",
        ...packages,
        "--no-audit",
        "--no-fund",
        "--prefix",
        installDir,
        "--userconfig",
        userConfigPath,
      ];
      const { exitCode, stdout, stderr } = await spawnAsync("npm", args, { env: npmEnv() });
      if (exitCode !== 0) {
        const details = [stdout, stderr].map((chunk) => chunk.trim()).filter(Boolean).join("\n");
        throw new Error(
          `Failed to install ${packages.join(", ")}.\n` +
            `Command: npm ${args.join(" ")}\n` +
            `${details || "No npm output captured."}`,
        );
      }
    });
  });

  const installedPkg = await loadPackageJsonFrom(cliPackageDir(installDir));
  if (!installedPkg?.bin?.flux) {
    throw new Error("Installed CLI missing bin entry");
  }
  return { version, binPath: path.join(cliPackageDir(installDir), installedPkg.bin.flux) };
}

function effectiveAutoUpdate(cfg: LauncherConfig): boolean {
  const override = process.env.FLUX_AUTO_UPDATE;
  if (override?.toLowerCase() === "0" || override?.toLowerCase() === "false") return false;
  if (override?.toLowerCase() === "1" || override?.toLowerCase() === "true") return true;
  return cfg.autoUpdate ?? true;
}

function logVerbose(enabled: boolean, message: string): void {
  if (enabled) {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}

async function resolveTargetVersions(
  cfg: LauncherConfig,
  overrides: { channel?: Channel; pin?: string | null; forceRefresh?: boolean },
  verbose: boolean,
): Promise<{ channel: Channel; versions: ResolvedVersions; usedCache: boolean }> {
  if (overrides.pin !== undefined) {
    cfg.pinnedVersion = overrides.pin || undefined;
    await writeConfig(cfg);
  }
  if (cfg.pinnedVersion) {
    const pinnedVersions = Object.fromEntries(SELF_UPDATE_PACKAGES.map((name) => [name, cfg.pinnedVersion as string]));
    return { channel: overrides.channel ?? cfg.channel ?? DEFAULT_CHANNEL, versions: pinnedVersions, usedCache: false };
  }

  const channel = overrides.channel ?? cfg.channel ?? DEFAULT_CHANNEL;
  const ttlMinutes = cfg.ttlMinutes ?? DEFAULT_TTL_MINUTES;
  const now = Date.now();
  const useCache = !overrides.forceRefresh && cfg.lastCheckMs && now - cfg.lastCheckMs < ttlMinutes * 60_000;
  const cached = normalizeLastResolved(cfg.lastResolved)[channel];

  logVerbose(verbose, `[self-update] channel ${channel}`);
  logVerbose(verbose, `[self-update] cache ${useCache ? "eligible" : "bypassed"}`);

  if (useCache && cached && SELF_UPDATE_PACKAGES.every((pkg) => cached[pkg])) {
    logVerbose(verbose, `[self-update] cache hit for channel ${channel}`);
    return { channel, versions: cached, usedCache: true };
  }

  try {
    const versions: ResolvedVersions = {};
    for (const pkg of SELF_UPDATE_PACKAGES) {
      const distTags = await fetchDistTags(pkg);
      const version = pickVersionFromDistTags(channel, distTags);
      logVerbose(verbose, `[self-update] ${pkg} dist-tags ${JSON.stringify(distTags)}`);
      logVerbose(verbose, `[self-update] ${pkg} -> ${version}`);
      versions[pkg] = version;
    }
    assertAlignedVersions(versions);

    cfg.channel = channel;
    cfg.lastResolved = { ...normalizeLastResolved(cfg.lastResolved), [channel]: versions };
    cfg.lastCheckMs = now;
    await writeConfig(cfg);
    logVerbose(verbose, `[self-update] resolved via registry (cache miss)`);
    return { channel, versions, usedCache: false };
  } catch (err) {
    if (cached) {
      logVerbose(verbose, `[self-update] registry lookup failed; falling back to cache`);
      return { channel, versions: cached, usedCache: true };
    }
    throw new Error(`Offline and no cached version available for channel '${channel}'. ${FIX_HINT}`);
  }
}

function npmEnv(): NodeJS.ProcessEnv {
  return { ...process.env, npm_config_update_notifier: "false" };
}

async function withTempNpmUserConfig<T>(fn: (userConfigPath: string) => Promise<T>): Promise<T> {
  await fs.mkdir(paths.cache, { recursive: true });
  const tempDir = await fs.mkdtemp(path.join(paths.cache, "npm-"));
  const userConfigPath = path.join(tempDir, "npmrc");
  await fs.writeFile(userConfigPath, "always-auth=false\nregistry=https://registry.npmjs.org/\n");
  try {
    return await fn(userConfigPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  await fs.mkdir(path.dirname(LOCK_PATH), { recursive: true });
  let handle: fs.FileHandle | null = null;
  try {
    handle = await fs.open(LOCK_PATH, "w");
    return await fn();
  } finally {
    await handle?.close();
  }
}

async function runSelfCommand(cmd: string | undefined, cfg: LauncherConfig, args: string[]): Promise<number> {
  const { verbose, rest } = parseVerboseFlag(args);
  switch (cmd) {
    case "status": {
      console.log(`channel ${cfg.channel ?? DEFAULT_CHANNEL}`);
      console.log(`pinned ${cfg.pinnedVersion ?? "none"}`);
      console.log(`autoUpdate ${effectiveAutoUpdate(cfg) ? "on" : "off"}`);
      console.log(`ttlMinutes ${cfg.ttlMinutes ?? DEFAULT_TTL_MINUTES}`);
      const last = normalizeLastResolved(cfg.lastResolved);
      for (const [key, versions] of Object.entries(last)) {
        console.log(`${key} ${JSON.stringify(versions)}`);
      }
      return 0;
    }
    case "autoupdate": {
      const next = (rest[0] ?? "").toLowerCase();
      if (next !== "on" && next !== "off") {
        console.error("Usage: flux self autoupdate on|off");
        return 1;
      }
      cfg.autoUpdate = next === "on";
      await writeConfig(cfg);
      console.log(`autoUpdate ${cfg.autoUpdate ? "on" : "off"}`);
      return 0;
    }
    case "update": {
      const { versions } = await resolveTargetVersions(cfg, { forceRefresh: true }, verbose);
      const version = assertAlignedVersions(versions);
      await ensureInstalled(version);
      console.log(`updated ${SELF_UPDATE_PACKAGES.join(", ")} to ${version}`);
      return 0;
    }
    case "channel": {
      const next = (rest[0] as Channel) ?? DEFAULT_CHANNEL;
      cfg.channel = next;
      await writeConfig(cfg);
      console.log(`channel set to ${next}`);
      return 0;
    }
    case "pin": {
      const version = rest[0];
      if (!version || !semver.valid(version)) {
        console.error("Provide a valid semver version to pin.");
        return 1;
      }
      cfg.pinnedVersion = version;
      await writeConfig(cfg);
      console.log(`pinned ${version}`);
      return 0;
    }
    case "unpin": {
      cfg.pinnedVersion = undefined;
      await writeConfig(cfg);
      console.log("un-pinned");
      return 0;
    }
    case "clear-cache": {
      await fs.rm(CACHE_ROOT, { recursive: true, force: true });
      console.log("cleared CLI cache");
      return 0;
    }
    default:
      console.error("Unknown self command. Supported: status, channel, update, pin, unpin, autoupdate, clear-cache");
      return 1;
  }
}

async function main(argv: string[]): Promise<number> {
  const parsed = parseArgs(argv);
  const cfg = await readConfig();
  const autoUpdate = effectiveAutoUpdate(cfg);

  if (parsed.selfCmd) {
    return runSelfCommand(parsed.selfCmd, cfg, parsed.passthrough);
  }

  const initial = await resolveTargetVersions(cfg, { channel: parsed.channel, pin: parsed.pin }, parsed.verbose);
  const version = assertAlignedVersions(initial.versions);

  let resolved: ResolvedCli | null = null;
  if (autoUpdate) {
    try {
      resolved = await ensureInstalled(version);
    } catch (err) {
      // If cached dist-tag is stale right after a publish, force-refresh once and retry.
      if (!cfg.pinnedVersion) {
        const fresh = await resolveTargetVersions(
          cfg,
          { channel: parsed.channel, pin: parsed.pin, forceRefresh: true },
          parsed.verbose,
        );
        const freshVersion = assertAlignedVersions(fresh.versions);
        if (freshVersion !== version) {
          resolved = await ensureInstalled(freshVersion);
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }
  } else {
    const bin = await resolveInstalledBin(version);
    if (bin) {
      resolved = { version, binPath: bin };
    } else {
      const cached = await newestCachedVersion();
      if (cached) {
        const cachedBin = await resolveInstalledBin(cached);
        if (cachedBin) {
          console.error(
            `Update available (@flux-lang/cli ${version}). Auto-update is off; using cached ${cached}. ` +
              `Run 'flux self update' or 'flux self autoupdate on' to install.`,
          );
          resolved = { version: cached, binPath: cachedBin };
        }
      }
      if (!resolved) {
        console.error(
          `No installed CLI found. Run 'flux self update' or enable auto-update with 'flux self autoupdate on'.`,
        );
        return 1;
      }
    }
  }

  const nodeArgs = [resolved.binPath, ...parsed.passthrough];
  const child = spawn(process.execPath, nodeArgs, { stdio: "inherit" });
  return await new Promise((resolve) => child.on("close", (code) => resolve(code ?? 0)));
}

async function spawnAsync(cmd: string, args: string[], options: { env?: NodeJS.ProcessEnv }): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return await new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (buf) => {
      stdout += buf.toString();
    });
    child.stderr?.on("data", (buf) => {
      stderr += buf.toString();
    });
    child.on("error", (err) => {
      stderr += `\n${String(err?.message ?? err)}`;
      resolve({ stdout, stderr, exitCode: 1 });
    });
    child.on("close", (code) => resolve({ stdout, stderr, exitCode: code }));
  });
}

void main(process.argv.slice(2)).then((code) => {
  if (code !== 0) process.exit(code);
}).catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
