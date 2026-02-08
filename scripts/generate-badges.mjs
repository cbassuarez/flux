import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BADGE_FALLBACK_VALUE,
  formatBadgeVersion,
  packageNameToSlug,
  renderBadgeSvg,
} from "../packages/brand/dist/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const BADGES_DIR = path.join(REPO_ROOT, "badges");
const CONFIG_PATH = path.join(BADGES_DIR, "badges.config.json");
const OUTPUT_DIR = path.join(BADGES_DIR, "generated");
const WORKFLOW_DIR = path.join(REPO_ROOT, ".github", "workflows");
const NINETY_DAYS_SEC = 90 * 24 * 60 * 60;

/**
 * @param {string[]} args
 * @returns {string}
 */
function runGit(args) {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
}

/**
 * @param {string} maybeUrl
 */
function inferRepoFromRemote(maybeUrl) {
  const match = maybeUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/i);
  if (!match) {
    return { org: "cbassuarez", repo: "flux" };
  }
  return { org: match[1], repo: match[2] };
}

/**
 * @param {string} branchRef
 */
function normalizeBranch(branchRef) {
  if (!branchRef) return "main";
  const parts = branchRef.split("/");
  return parts[parts.length - 1] || "main";
}

/**
 * @param {string} filePath
 */
async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function readConfig() {
  if (!existsSync(CONFIG_PATH)) return {};
  return readJson(CONFIG_PATH);
}

async function listWorkflowFiles() {
  if (!existsSync(WORKFLOW_DIR)) return [];
  const entries = await readdir(WORKFLOW_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")))
    .map((entry) => entry.name)
    .sort();
}

/**
 * @param {Record<string, any>} config
 * @param {string[]} workflowFiles
 */
async function resolveWorkflowFile(config, workflowFiles) {
  if (typeof config.ciWorkflowFile === "string" && workflowFiles.includes(config.ciWorkflowFile)) {
    return config.ciWorkflowFile;
  }

  if (typeof config.ciWorkflowName === "string") {
    for (const workflowFile of workflowFiles) {
      const fullPath = path.join(WORKFLOW_DIR, workflowFile);
      const content = await readFile(fullPath, "utf8");
      const nameMatch = content.match(/^name:\s*(.+)\s*$/m);
      if (nameMatch && nameMatch[1].trim() === config.ciWorkflowName.trim()) {
        return workflowFile;
      }
    }
  }

  if (workflowFiles.includes("ci.yml")) return "ci.yml";
  if (workflowFiles.includes("ci.yaml")) return "ci.yaml";
  return workflowFiles[0] ?? "";
}

/**
 * @param {string[]} patterns
 */
async function expandWorkspacePatterns(patterns) {
  const directories = new Set();
  for (const pattern of patterns) {
    if (typeof pattern !== "string" || pattern.length === 0) continue;
    if (pattern.endsWith("/*")) {
      const baseDir = path.join(REPO_ROOT, pattern.slice(0, -2));
      if (!existsSync(baseDir)) continue;
      const entries = await readdir(baseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) directories.add(path.join(baseDir, entry.name));
      }
      continue;
    }

    const absolute = path.join(REPO_ROOT, pattern);
    if (existsSync(absolute)) directories.add(absolute);
  }

  return [...directories];
}

async function collectWorkspacePackages(config) {
  const rootPkg = await readJson(path.join(REPO_ROOT, "package.json"));
  const workspacePatterns = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : [];
  const workspaceDirs = await expandWorkspacePatterns(workspacePatterns);
  /** @type {Map<string, string>} */
  const versionByPackage = new Map();
  const packageNames = [];

  for (const workspaceDir of workspaceDirs) {
    const pkgPath = path.join(workspaceDir, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = await readJson(pkgPath);
    if (pkg.private) continue;
    if (typeof pkg.name !== "string" || pkg.name.length === 0) continue;
    if (typeof config.npmScope === "string" && config.npmScope.length > 0 && !pkg.name.startsWith(`${config.npmScope}/`)) {
      continue;
    }
    if (Array.isArray(config.packageAllowlist) && config.packageAllowlist.length > 0 && !config.packageAllowlist.includes(pkg.name)) {
      continue;
    }
    packageNames.push(pkg.name);
    if (typeof pkg.version === "string") versionByPackage.set(pkg.name, pkg.version);
  }

  packageNames.sort();
  return { packageNames, versionByPackage };
}

/**
 * @param {string} packageName
 */
async function fetchNpmInfo(packageName) {
  const encoded = encodeURIComponent(packageName);
  const url = `https://registry.npmjs.org/${encoded}`;
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`npm ${response.status}`);
    const payload = await response.json();
    const distTags = payload && typeof payload["dist-tags"] === "object" ? payload["dist-tags"] : {};
    return { packageName, distTags };
  } catch {
    return { packageName, distTags: {} };
  }
}

async function detectLicense() {
  const rootPkg = await readJson(path.join(REPO_ROOT, "package.json"));
  if (typeof rootPkg.license === "string" && rootPkg.license.trim()) return rootPkg.license.trim();

  const licensePaths = ["LICENSE", "LICENSE.md", "LICENSE.txt"].map((name) => path.join(REPO_ROOT, name));
  for (const licensePath of licensePaths) {
    if (!existsSync(licensePath)) continue;
    const raw = await readFile(licensePath, "utf8");
    if (/MIT License/i.test(raw)) return "MIT";
    if (/Apache License/i.test(raw)) return "Apache-2.0";
    if (/GNU GENERAL PUBLIC LICENSE/i.test(raw)) return "GPL";
    return "custom";
  }

  if (rootPkg.private) return "UNLICENSED";
  return "unknown";
}

async function detectMaintainedValue() {
  try {
    const latestCommitEpoch = Number(runGit(["log", "-1", "--format=%ct"]));
    if (!Number.isFinite(latestCommitEpoch) || latestCommitEpoch <= 0) return "unknown";
    const age = Math.floor(Date.now() / 1000) - latestCommitEpoch;
    return age <= NINETY_DAYS_SEC ? "yes" : "stale";
  } catch {
    return "unknown";
  }
}

/**
 * @param {Object} input
 * @param {string} input.org
 * @param {string} input.repo
 * @param {string} input.defaultBranch
 * @param {string} input.workflowFile
 */
async function resolveCiStatus({ org, repo, defaultBranch, workflowFile }) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token || !org || !repo || !workflowFile) return "unknown";

  const query = new URLSearchParams({
    branch: defaultBranch,
    per_page: "1",
  });
  const url = `https://api.github.com/repos/${org}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?${query.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "user-agent": "flux-badges-generator",
      },
    });
    if (!response.ok) return "unknown";
    const payload = await response.json();
    const run = Array.isArray(payload.workflow_runs) ? payload.workflow_runs[0] : null;
    if (!run) return "unknown";

    const status = typeof run.status === "string" ? run.status : "";
    const conclusion = typeof run.conclusion === "string" ? run.conclusion : "";

    if (status && status !== "completed") return "running";
    if (conclusion === "success") return "passing";
    if (conclusion === "cancelled") return "cancelled";
    if (conclusion === "failure" || conclusion === "timed_out" || conclusion === "startup_failure") return "failing";
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * @param {string} fileName
 * @param {import("../packages/brand/dist/index.js").BadgeSvgOptions} options
 */
async function writeThemePair(fileName, options) {
  const lightSvg = renderBadgeSvg({ ...options, theme: "light" });
  const darkSvg = renderBadgeSvg({ ...options, theme: "dark" });

  await writeFile(path.join(OUTPUT_DIR, `${fileName}.light.svg`), lightSvg, "utf8");
  await writeFile(path.join(OUTPUT_DIR, `${fileName}.dark.svg`), darkSvg, "utf8");
}

async function main() {
  const config = await readConfig();
  const remote = runGit(["remote", "get-url", "origin"]);
  const inferredRepo = inferRepoFromRemote(remote);
  const org = config.org ?? inferredRepo.org;
  const repo = config.repo ?? inferredRepo.repo;
  const defaultBranch = config.defaultBranch ?? normalizeBranch(runGit(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]));

  const workflowFiles = await listWorkflowFiles();
  const workflowFile = await resolveWorkflowFile(config, workflowFiles);

  const docsUrl = config.docsUrl ?? "https://flux-lang.org/docs";
  const discordUrl = config.discordUrl ?? `https://github.com/${org}/${repo}/discussions`;
  const securityUrl = config.securityUrl ?? `https://github.com/${org}/${repo}/security/policy`;

  const workspacePackages = await collectWorkspacePackages(config);
  const explicitPackages = Array.isArray(config.npmPackages) ? config.npmPackages.filter((value) => typeof value === "string") : [];
  const packageNames = explicitPackages.length > 0 ? explicitPackages : workspacePackages.packageNames;
  if (packageNames.length === 0) {
    throw new Error("No npm packages resolved. Add npmPackages to badges/badges.config.json.");
  }

  const npmInfo = await Promise.all(packageNames.map((name) => fetchNpmInfo(name)));
  const ciStatus = await resolveCiStatus({ org, repo, defaultBranch, workflowFile });
  const license = await detectLicense();
  const maintained = await detectMaintainedValue();

  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  for (const info of npmInfo) {
    const slug = packageNameToSlug(info.packageName);
    const latestRaw = typeof info.distTags.latest === "string" ? info.distTags.latest : workspacePackages.versionByPackage.get(info.packageName);
    const latestValue = formatBadgeVersion(latestRaw) ?? BADGE_FALLBACK_VALUE;

    await writeThemePair(`npm.${slug}`, {
      kind: "npm",
      label: info.packageName,
      value: latestValue,
      title: `${info.packageName} ${latestValue}`,
    });

    /** @type {const} */
    const channels = ["stable", "nightly", "canary"];
    for (const channel of channels) {
      const tagName = channel === "stable" ? "latest" : channel;
      const rawTag = typeof info.distTags[tagName] === "string" ? info.distTags[tagName] : undefined;
      const channelValue = formatBadgeVersion(rawTag) ?? BADGE_FALLBACK_VALUE;
      await writeThemePair(`channel.${slug}.${channel}`, {
        kind: "channel",
        label: channel,
        value: channelValue,
        title: `${channel} ${channelValue}`,
      });
    }
  }

  await writeThemePair("ci", {
    kind: "ci",
    label: "CI",
    value: ciStatus,
    title: `CI ${ciStatus}`,
  });

  await writeThemePair("license", {
    kind: "license",
    label: "License",
    value: license,
    title: `License ${license}`,
  });

  await writeThemePair("docs", {
    kind: "docs",
    label: "Docs",
    value: "site",
    title: docsUrl,
  });

  await writeThemePair("discord", {
    kind: "discord",
    label: "Community",
    value: "chat",
    title: discordUrl,
  });

  await writeThemePair("security", {
    kind: "security",
    label: "Security",
    value: "policy",
    title: securityUrl,
  });

  await writeThemePair("maintained", {
    kind: "maintained",
    label: "Maintained",
    value: maintained,
    title: `Maintained ${maintained}`,
  });

  const generatedFiles = await readdir(OUTPUT_DIR);
  console.log(`Generated ${generatedFiles.length} badge SVG files in ${path.relative(REPO_ROOT, OUTPUT_DIR)}`);
}

await main();
