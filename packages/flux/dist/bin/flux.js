#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import envPaths from "env-paths";
import semver from "semver";
const paths = envPaths("flux", { suffix: "" });
const CONFIG_PATH = path.join(paths.config, "config.json");
const CACHE_ROOT = path.join(paths.cache, "cli");
const LOCK_PATH = path.join(paths.cache, "install.lock");
const DEFAULT_CHANNEL = "canary";
const DEFAULT_TTL_MINUTES = 10;
const FIX_HINT = "Re-run online or set a pinned version via `flux self pin <version>`.";
async function readConfig() {
    try {
        const raw = await fs.readFile(CONFIG_PATH, "utf8");
        const cfg = JSON.parse(raw);
        return {
            channel: cfg.channel ?? DEFAULT_CHANNEL,
            pinnedVersion: cfg.pinnedVersion,
            lastResolved: cfg.lastResolved ?? {},
            lastCheckMs: cfg.lastCheckMs,
            autoUpdate: cfg.autoUpdate ?? true,
            ttlMinutes: cfg.ttlMinutes ?? DEFAULT_TTL_MINUTES,
        };
    }
    catch {
        return { channel: DEFAULT_CHANNEL, autoUpdate: true, ttlMinutes: DEFAULT_TTL_MINUTES };
    }
}
async function writeConfig(cfg) {
    await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
    await fs.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}
function parseArgs(argv) {
    const passthrough = [];
    let channel;
    let pin;
    let selfCmd;
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "--channel") {
            channel = argv[i + 1] ?? channel;
            i += 1;
            continue;
        }
        if (arg.startsWith("--channel=")) {
            channel = arg.slice("--channel=".length);
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
        }
        else {
            passthrough.push(arg);
        }
    }
    return { channel, pin, selfCmd, passthrough };
}
async function loadPackageJsonFrom(dir) {
    try {
        const data = await fs.readFile(path.join(dir, "package.json"), "utf8");
        return JSON.parse(data);
    }
    catch {
        return null;
    }
}
function cliPackageDir(installDir) {
    return path.join(installDir, "node_modules", "@flux-lang", "cli");
}
async function resolveDistTag(channel) {
    const { stdout, exitCode } = await spawnAsync("npm", ["view", "@flux-lang/cli", `dist-tags.${channel}`, "--json"], {
        env: npmEnv(),
    });
    if (exitCode !== 0)
        throw new Error("npm view failed");
    return stdout.trim().replace(/"/g, "");
}
async function hasInstalled(version) {
    const pkg = await loadPackageJsonFrom(cliPackageDir(path.join(CACHE_ROOT, version)));
    return Boolean(pkg?.version === version && pkg.bin && pkg.bin.flux);
}
async function resolveInstalledBin(version) {
    const installDir = path.join(CACHE_ROOT, version);
    const pkg = await loadPackageJsonFrom(cliPackageDir(installDir));
    if (pkg?.version === version && pkg.bin?.flux) {
        return path.join(cliPackageDir(installDir), pkg.bin.flux);
    }
    return null;
}
async function newestCachedVersion() {
    try {
        const entries = await fs.readdir(CACHE_ROOT, { withFileTypes: true });
        const versions = entries.filter((e) => e.isDirectory()).map((e) => e.name).filter((v) => semver.valid(v));
        if (!versions.length)
            return null;
        versions.sort((a, b) => semver.rcompare(a, b));
        return versions[0];
    }
    catch {
        return null;
    }
}
async function ensureInstalled(version) {
    const installDir = path.join(CACHE_ROOT, version);
    const pkg = await loadPackageJsonFrom(cliPackageDir(installDir));
    if (pkg?.version === version && pkg.bin && pkg.bin.flux) {
        return { version, binPath: path.join(cliPackageDir(installDir), pkg.bin.flux) };
    }
    await withLock(async () => {
        await fs.mkdir(installDir, { recursive: true });
        const args = ["install", `@flux-lang/cli@${version}`, "--no-audit", "--no-fund", "--prefix", installDir];
        const { exitCode, stdout, stderr } = await spawnAsync("npm", args, { env: npmEnv() });
        if (exitCode !== 0) {
            const details = [stdout, stderr].map((chunk) => chunk.trim()).filter(Boolean).join("\n");
            throw new Error(`Failed to install @flux-lang/cli@${version}.\n` +
                `Command: npm ${args.join(" ")}\n` +
                `${details || "No npm output captured."}`);
        }
    });
    const installedPkg = await loadPackageJsonFrom(cliPackageDir(installDir));
    if (!installedPkg?.bin?.flux) {
        throw new Error("Installed CLI missing bin entry");
    }
    return { version, binPath: path.join(cliPackageDir(installDir), installedPkg.bin.flux) };
}
function effectiveAutoUpdate(cfg) {
    const override = process.env.FLUX_AUTO_UPDATE;
    if (override?.toLowerCase() === "0" || override?.toLowerCase() === "false")
        return false;
    if (override?.toLowerCase() === "1" || override?.toLowerCase() === "true")
        return true;
    return cfg.autoUpdate ?? true;
}
async function resolveTargetVersion(cfg, overrides) {
    if (overrides.pin !== undefined) {
        cfg.pinnedVersion = overrides.pin || undefined;
        await writeConfig(cfg);
    }
    if (cfg.pinnedVersion)
        return cfg.pinnedVersion;
    const channel = overrides.channel ?? cfg.channel ?? DEFAULT_CHANNEL;
    const ttlMinutes = cfg.ttlMinutes ?? DEFAULT_TTL_MINUTES;
    const now = Date.now();
    const useCache = !overrides.forceRefresh && cfg.lastCheckMs && now - cfg.lastCheckMs < ttlMinutes * 60_000;
    if (useCache && cfg.lastResolved?.[channel]) {
        return cfg.lastResolved[channel];
    }
    try {
        const version = await resolveDistTag(channel);
        cfg.channel = channel;
        cfg.lastResolved = { ...(cfg.lastResolved ?? {}), [channel]: version };
        cfg.lastCheckMs = now;
        await writeConfig(cfg);
        return version;
    }
    catch {
        const cached = cfg.lastResolved?.[channel];
        if (cached)
            return cached;
        throw new Error(`Offline and no cached version available for channel '${channel}'. ${FIX_HINT}`);
    }
}
function npmEnv() {
    return { ...process.env, npm_config_update_notifier: "false" };
}
async function withLock(fn) {
    await fs.mkdir(path.dirname(LOCK_PATH), { recursive: true });
    let handle = null;
    try {
        handle = await fs.open(LOCK_PATH, "w");
        return await fn();
    }
    finally {
        await handle?.close();
    }
}
async function runSelfCommand(cmd, cfg, args) {
    switch (cmd) {
        case "status": {
            console.log(`channel ${cfg.channel ?? DEFAULT_CHANNEL}`);
            console.log(`pinned ${cfg.pinnedVersion ?? "none"}`);
            console.log(`autoUpdate ${effectiveAutoUpdate(cfg) ? "on" : "off"}`);
            console.log(`ttlMinutes ${cfg.ttlMinutes ?? DEFAULT_TTL_MINUTES}`);
            const last = cfg.lastResolved ?? {};
            for (const key of Object.keys(last)) {
                console.log(`${key} ${last[key]}`);
            }
            return 0;
        }
        case "autoupdate": {
            const next = (args[0] ?? "").toLowerCase();
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
            const version = await resolveTargetVersion(cfg, { forceRefresh: true });
            await ensureInstalled(version);
            console.log(`updated @flux-lang/cli to ${version}`);
            return 0;
        }
        case "channel": {
            const next = args[0] ?? DEFAULT_CHANNEL;
            cfg.channel = next;
            await writeConfig(cfg);
            console.log(`channel set to ${next}`);
            return 0;
        }
        case "pin": {
            const version = args[0];
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
            console.error("Unknown self command. Supported: status, channel, pin, unpin, clear-cache");
            return 1;
    }
}
async function main(argv) {
    const parsed = parseArgs(argv);
    const cfg = await readConfig();
    const autoUpdate = effectiveAutoUpdate(cfg);
    if (parsed.selfCmd) {
        return runSelfCommand(parsed.selfCmd, cfg, parsed.passthrough);
    }
    const version = await resolveTargetVersion(cfg, { channel: parsed.channel, pin: parsed.pin });
    let resolved = null;
    if (autoUpdate) {
        try {
            resolved = await ensureInstalled(version);
        }
        catch (err) {
            // If cached dist-tag is stale right after a publish, force-refresh once and retry.
            if (!cfg.pinnedVersion) {
                const freshVersion = await resolveTargetVersion(cfg, {
                    channel: parsed.channel,
                    pin: parsed.pin,
                    forceRefresh: true,
                });
                if (freshVersion !== version) {
                    resolved = await ensureInstalled(freshVersion);
                }
                else {
                    throw err;
                }
            }
            else {
                throw err;
            }
        }
    }
    else {
        const bin = await resolveInstalledBin(version);
        if (bin) {
            resolved = { version, binPath: bin };
        }
        else {
            const cached = await newestCachedVersion();
            if (cached) {
                const cachedBin = await resolveInstalledBin(cached);
                if (cachedBin) {
                    console.error(`Update available (@flux-lang/cli ${version}). Auto-update is off; using cached ${cached}. ` +
                        `Run 'flux self update' or 'flux self autoupdate on' to install.`);
                    resolved = { version: cached, binPath: cachedBin };
                }
            }
            if (!resolved) {
                console.error(`No installed CLI found. Run 'flux self update' or enable auto-update with 'flux self autoupdate on'.`);
                return 1;
            }
        }
    }
    const nodeArgs = [resolved.binPath, ...parsed.passthrough];
    const child = spawn(process.execPath, nodeArgs, { stdio: "inherit" });
    return await new Promise((resolve) => child.on("close", (code) => resolve(code ?? 0)));
}
async function spawnAsync(cmd, args, options) {
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
    if (code !== 0)
        process.exit(code);
}).catch((err) => {
    console.error(err?.message ?? err);
    process.exit(1);
});
