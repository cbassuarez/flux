import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BADGE_FALLBACK_VALUE, formatBadgeVersion, packageNameToSlug } from "../badge-shared.js";
import { renderBadgeSvg } from "../badge-svg.js";
import { renderFluxNpmBadgeSvg } from "./flux-npm-svg.js";

const BADGE_BLOCK_START = "<!-- FLUX:BADGES:BEGIN -->";
const BADGE_BLOCK_END = "<!-- FLUX:BADGES:END -->";
const FLUX_PACKAGE_NAME = "@flux-lang/flux";
const NINETY_DAYS_SEC = 90 * 24 * 60 * 60;

type BadgeConfig = {
  org?: string;
  repo?: string;
  defaultBranch?: string;
  docsUrl?: string;
  discordUrl?: string;
  securityUrl?: string;
  ciWorkflowFile?: string;
  ciWorkflowName?: string;
  npmScope?: string;
  npmPackages?: string[];
  packageAllowlist?: string[];
  primaryNpmPackage?: string;
};

type WorkspacePackage = {
  name: string;
  version?: string;
  directory: string;
  readmePath: string;
};

type DistTagInfo = {
  packageName: string;
  distTags: Record<string, string>;
};

type RepoMetadata = {
  org: string;
  repo: string;
  defaultBranch: string;
  workflowFile: string;
  docsUrl: string;
  discordUrl: string;
  securityUrl: string;
};

type RootBadgeContext = {
  repoRoot: string;
  metadata: RepoMetadata;
  licenseHref: string;
  fluxVersionLabel: string;
  fluxHasCanary: boolean;
};

type PackageBadgeContext = {
  repoRoot: string;
  metadata: RepoMetadata;
  licenseHref: string;
  packageName: string;
  packageSlug: string;
  stableVersionLabel: string;
  canaryVersionLabel?: string;
};

type PictureBadgeSpec = {
  fileBase: string;
  alt: string;
  href?: string;
};

function toPosix(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function ensureDotSlash(relativePath: string): string {
  if (relativePath.startsWith("./") || relativePath.startsWith("../")) return relativePath;
  return `./${relativePath}`;
}

function normalizeBranch(branchRef: string): string {
  const trimmed = branchRef.trim();
  if (!trimmed) return "main";
  const parts = trimmed.split("/");
  return parts[parts.length - 1] || "main";
}

function isExternalLink(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function runGit(repoRoot: string, args: string[], fallback = ""): string {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return fallback;
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function parsePnpmWorkspacePatterns(repoRoot: string): Promise<string[]> {
  const pnpmWorkspacePath = path.join(repoRoot, "pnpm-workspace.yaml");
  if (!existsSync(pnpmWorkspacePath)) return [];
  const raw = await readFile(pnpmWorkspacePath, "utf8");
  const patterns: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*-\s*['"]?(.+?)['"]?\s*$/);
    if (!match) continue;
    patterns.push(match[1]);
  }
  return patterns;
}

async function readBadgeConfig(repoRoot: string): Promise<BadgeConfig> {
  const rootConfigPath = path.join(repoRoot, "badge.config.json");
  const legacyConfigPath = path.join(repoRoot, "badges", "badges.config.json");
  let config: BadgeConfig = {};

  if (existsSync(legacyConfigPath)) {
    const legacy = await readJson<BadgeConfig>(legacyConfigPath);
    config = { ...config, ...legacy };
  }

  if (existsSync(rootConfigPath)) {
    const root = await readJson<BadgeConfig>(rootConfigPath);
    config = { ...config, ...root };
  }

  return config;
}

function inferRepoFromRemote(remoteUrl: string): { org: string; repo: string } {
  const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/i);
  if (!match) return { org: "cbassuarez", repo: "flux" };
  return { org: match[1], repo: match[2] };
}

async function listWorkflowFiles(repoRoot: string): Promise<string[]> {
  const workflowDir = path.join(repoRoot, ".github", "workflows");
  if (!existsSync(workflowDir)) return [];
  const entries = await readdir(workflowDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")))
    .map((entry) => entry.name)
    .sort();
}

async function resolveWorkflowFile(repoRoot: string, config: BadgeConfig, workflowFiles: string[]): Promise<string> {
  const workflowDir = path.join(repoRoot, ".github", "workflows");
  if (typeof config.ciWorkflowFile === "string" && workflowFiles.includes(config.ciWorkflowFile)) {
    return config.ciWorkflowFile;
  }

  if (typeof config.ciWorkflowName === "string") {
    const targetName = config.ciWorkflowName.trim();
    for (const fileName of workflowFiles) {
      const raw = await readFile(path.join(workflowDir, fileName), "utf8");
      const nameMatch = raw.match(/^name:\s*(.+)\s*$/m);
      if (nameMatch && nameMatch[1].trim() === targetName) {
        return fileName;
      }
    }
  }

  const preferred = ["ci.yml", "ci.yaml", "deploy.yml", "deploy.yaml", "release.yml", "publish.yml"];
  for (const fileName of preferred) {
    if (workflowFiles.includes(fileName)) return fileName;
  }
  return workflowFiles[0] ?? "";
}

async function expandWorkspacePatterns(repoRoot: string, patterns: string[]): Promise<string[]> {
  const directories = new Set<string>();
  for (const pattern of patterns) {
    if (!pattern || typeof pattern !== "string") continue;
    if (pattern.endsWith("/*")) {
      const baseDir = path.join(repoRoot, pattern.slice(0, -2));
      if (!existsSync(baseDir)) continue;
      const entries = await readdir(baseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) directories.add(path.join(baseDir, entry.name));
      }
      continue;
    }

    const absoluteDir = path.join(repoRoot, pattern);
    if (existsSync(absoluteDir)) directories.add(absoluteDir);
  }
  return [...directories];
}

async function collectWorkspacePackages(repoRoot: string, config: BadgeConfig): Promise<WorkspacePackage[]> {
  const rootPackagePath = path.join(repoRoot, "package.json");
  if (!existsSync(rootPackagePath)) return [];
  const rootPackage = await readJson<{ workspaces?: string[] | { packages?: string[] } }>(rootPackagePath);
  const explicitWorkspaces = Array.isArray(rootPackage.workspaces)
    ? rootPackage.workspaces
    : Array.isArray(rootPackage.workspaces?.packages)
      ? rootPackage.workspaces.packages
      : [];
  const pnpmPatterns = explicitWorkspaces.length > 0 ? [] : await parsePnpmWorkspacePatterns(repoRoot);
  const fallbackPatterns = existsSync(path.join(repoRoot, "packages")) ? ["packages/*"] : [];
  const patterns = explicitWorkspaces.length > 0 ? explicitWorkspaces : pnpmPatterns.length > 0 ? pnpmPatterns : fallbackPatterns;
  const workspaceDirs = await expandWorkspacePatterns(repoRoot, patterns);

  const packages: WorkspacePackage[] = [];
  for (const workspaceDir of workspaceDirs) {
    const packagePath = path.join(workspaceDir, "package.json");
    if (!existsSync(packagePath)) continue;
    const pkg = await readJson<{ name?: string; version?: string; private?: boolean }>(packagePath);
    if (pkg.private) continue;
    if (!pkg.name) continue;
    if (typeof config.npmScope === "string" && config.npmScope.length > 0 && !pkg.name.startsWith(`${config.npmScope}/`)) {
      continue;
    }
    if (Array.isArray(config.packageAllowlist) && config.packageAllowlist.length > 0 && !config.packageAllowlist.includes(pkg.name)) {
      continue;
    }

    packages.push({
      name: pkg.name,
      version: pkg.version,
      directory: workspaceDir,
      readmePath: path.join(workspaceDir, "README.md"),
    });
  }

  packages.sort((left, right) => left.name.localeCompare(right.name));
  return packages;
}

async function fetchNpmInfo(packageName: string): Promise<DistTagInfo> {
  const encodedName = encodeURIComponent(packageName);
  const url = `https://registry.npmjs.org/${encodedName}`;
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`npm ${response.status}`);
    const payload = (await response.json()) as { "dist-tags"?: Record<string, string> };
    return { packageName, distTags: payload["dist-tags"] ?? {} };
  } catch {
    return { packageName, distTags: {} };
  }
}

async function detectLicense(repoRoot: string): Promise<string> {
  const rootPackage = await readJson<{ license?: string; private?: boolean }>(path.join(repoRoot, "package.json"));
  if (typeof rootPackage.license === "string" && rootPackage.license.trim()) return rootPackage.license.trim();

  const candidatePaths = ["LICENSE", "LICENSE.md", "LICENSE.txt"].map((name) => path.join(repoRoot, name));
  for (const candidate of candidatePaths) {
    if (!existsSync(candidate)) continue;
    const raw = await readFile(candidate, "utf8");
    if (/MIT License/i.test(raw)) return "MIT";
    if (/Apache License/i.test(raw)) return "Apache-2.0";
    if (/GNU GENERAL PUBLIC LICENSE/i.test(raw)) return "GPL";
    return "custom";
  }

  if (rootPackage.private) return "UNLICENSED";
  return "unknown";
}

function findLicensePath(repoRoot: string): string | undefined {
  const candidates = ["LICENSE", "LICENSE.md", "LICENSE.txt"].map((name) => path.join(repoRoot, name));
  return candidates.find((candidate) => existsSync(candidate));
}

function detectMaintainedValue(repoRoot: string, defaultBranch: string): string {
  const refs = [`origin/${defaultBranch}`, defaultBranch, "HEAD"];
  for (const ref of refs) {
    const rawEpoch = runGit(repoRoot, ["log", "-1", "--format=%ct", ref]);
    const epoch = Number(rawEpoch);
    if (!Number.isFinite(epoch) || epoch <= 0) continue;
    const ageInSeconds = Math.floor(Date.now() / 1000) - epoch;
    return ageInSeconds <= NINETY_DAYS_SEC ? "yes" : "stale";
  }
  return "unknown";
}

async function resolveCiStatus(metadata: RepoMetadata): Promise<string> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token || !metadata.workflowFile) return "unknown";

  const query = new URLSearchParams({
    branch: metadata.defaultBranch,
    per_page: "1",
  });
  const url = `https://api.github.com/repos/${metadata.org}/${metadata.repo}/actions/workflows/${encodeURIComponent(metadata.workflowFile)}/runs?${query.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "user-agent": "flux-badge-generator",
      },
    });
    if (!response.ok) return "unknown";
    const payload = (await response.json()) as {
      workflow_runs?: Array<{ status?: string; conclusion?: string }>;
    };
    const run = Array.isArray(payload.workflow_runs) ? payload.workflow_runs[0] : undefined;
    if (!run) return "unknown";
    if (run.status && run.status !== "completed") return "running";
    if (run.conclusion === "success") return "passing";
    if (run.conclusion === "cancelled") return "cancelled";
    if (run.conclusion === "failure" || run.conclusion === "timed_out" || run.conclusion === "startup_failure") return "failing";
    return "unknown";
  } catch {
    return "unknown";
  }
}

async function writeThemePair(
  outputDir: string,
  fileBase: string,
  render: (theme: "light" | "dark") => string,
): Promise<void> {
  await writeFile(path.join(outputDir, `${fileBase}.light.svg`), render("light"), "utf8");
  await writeFile(path.join(outputDir, `${fileBase}.dark.svg`), render("dark"), "utf8");
}

function relativeAssetPath(repoRoot: string, readmePath: string, fileBase: string, theme: "light" | "dark"): string {
  const targetPath = path.join(repoRoot, "badges", "generated", `${fileBase}.${theme}.svg`);
  const relativePath = toPosix(path.relative(path.dirname(readmePath), targetPath));
  return ensureDotSlash(relativePath);
}

function renderPictureBadge(repoRoot: string, readmePath: string, spec: PictureBadgeSpec): string {
  const lightSrc = relativeAssetPath(repoRoot, readmePath, spec.fileBase, "light");
  const darkSrc = relativeAssetPath(repoRoot, readmePath, spec.fileBase, "dark");
  const alt = escapeHtml(spec.alt);
  const picture = [
    "<picture>",
    `      <source media="(prefers-color-scheme: dark)" srcset="${escapeHtml(darkSrc)}">`,
    `      <img alt="${alt}" src="${escapeHtml(lightSrc)}">`,
    "    </picture>",
  ].join("\n");

  if (!spec.href) return `  ${picture}`;
  const href = escapeHtml(spec.href);
  if (isExternalLink(spec.href)) {
    return [`  <a href="${href}" target="_blank" rel="noreferrer">`, picture, "  </a>"].join("\n");
  }
  return [`  <a href="${href}">`, picture, "  </a>"].join("\n");
}

function buildBadgeBlock(repoRoot: string, readmePath: string, specs: PictureBadgeSpec[]): string {
  const badgeMarkup = specs.map((spec) => renderPictureBadge(repoRoot, readmePath, spec)).join("\n");
  return [BADGE_BLOCK_START, "<p>", badgeMarkup, "</p>", BADGE_BLOCK_END].join("\n");
}

function removeLegacyBadgeSection(lines: string[], insertAt: number): number {
  if (insertAt >= lines.length) return insertAt;
  if (lines[insertAt].trim() === "<p>") {
    let closingIndex = insertAt + 1;
    while (closingIndex < lines.length && lines[closingIndex].trim() !== "</p>") closingIndex += 1;
    if (closingIndex < lines.length) {
      lines.splice(insertAt, closingIndex - insertAt + 1);
      while (insertAt < lines.length && lines[insertAt].trim() === "") lines.splice(insertAt, 1);
      return insertAt;
    }
  }

  let scan = insertAt;
  while (scan < lines.length) {
    const trimmed = lines[scan].trim();
    if (trimmed.length === 0) {
      scan += 1;
      continue;
    }
    if (trimmed.startsWith("[![") && trimmed.includes("](")) {
      scan += 1;
      continue;
    }
    break;
  }
  if (scan > insertAt) {
    lines.splice(insertAt, scan - insertAt);
  }
  return insertAt;
}

function upsertBadgeBlock(markdown: string, block: string): string {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const startIndex = normalized.indexOf(BADGE_BLOCK_START);
  const endIndex = normalized.indexOf(BADGE_BLOCK_END);

  if (startIndex >= 0 && endIndex > startIndex) {
    const before = normalized.slice(0, startIndex).trimEnd();
    const after = normalized.slice(endIndex + BADGE_BLOCK_END.length).trimStart();
    const merged = [before, block, after].filter((part) => part.length > 0).join("\n\n");
    return `${merged.trimEnd()}\n`;
  }

  const lines = normalized.split("\n");
  let insertAt = 0;
  if (lines[0]?.startsWith("#")) {
    insertAt = 1;
    while (insertAt < lines.length && lines[insertAt].trim() === "") insertAt += 1;
    insertAt = removeLegacyBadgeSection(lines, insertAt);
  }

  const before = lines.slice(0, insertAt).join("\n").trimEnd();
  const after = lines.slice(insertAt).join("\n").trimStart();
  const merged = [before, block, after].filter((part) => part.length > 0).join("\n\n");
  return `${merged.trimEnd()}\n`;
}

async function writeIfChanged(filePath: string, nextContent: string): Promise<void> {
  const current = existsSync(filePath) ? await readFile(filePath, "utf8") : "";
  if (current === nextContent) return;
  await writeFile(filePath, nextContent, "utf8");
}

function buildRootBadgeSpecs(context: RootBadgeContext): PictureBadgeSpec[] {
  const channelSlug = packageNameToSlug(FLUX_PACKAGE_NAME);
  const workflowHref = context.metadata.workflowFile
    ? `https://github.com/${context.metadata.org}/${context.metadata.repo}/actions/workflows/${context.metadata.workflowFile}`
    : `https://github.com/${context.metadata.org}/${context.metadata.repo}/actions`;

  const specs: PictureBadgeSpec[] = [
    {
      fileBase: "flux-npm",
      alt: `${FLUX_PACKAGE_NAME} npm version`,
      href: `https://www.npmjs.com/package/${FLUX_PACKAGE_NAME}`,
    },
    {
      fileBase: "ci",
      alt: "CI status",
      href: workflowHref,
    },
    {
      fileBase: "license",
      alt: "License",
      href: context.licenseHref,
    },
    {
      fileBase: "docs",
      alt: "Docs",
      href: context.metadata.docsUrl,
    },
    {
      fileBase: "discord",
      alt: "Community",
      href: context.metadata.discordUrl,
    },
    {
      fileBase: "security",
      alt: "Security policy",
      href: context.metadata.securityUrl,
    },
    {
      fileBase: "maintained",
      alt: "Maintained status",
      href: `https://github.com/${context.metadata.org}/${context.metadata.repo}/commits/${context.metadata.defaultBranch}`,
    },
    {
      fileBase: `channel.${channelSlug}.stable`,
      alt: "Release channel stable",
      href: `https://www.npmjs.com/package/${FLUX_PACKAGE_NAME}`,
    },
  ];

  if (context.fluxHasCanary) {
    specs.push({
      fileBase: `channel.${channelSlug}.canary`,
      alt: "Release channel canary",
      href: `https://www.npmjs.com/package/${FLUX_PACKAGE_NAME}`,
    });
  }

  return specs;
}

function buildPackageBadgeSpecs(context: PackageBadgeContext): PictureBadgeSpec[] {
  const npmFileBase = context.packageName === FLUX_PACKAGE_NAME ? "flux-npm" : `npm.${context.packageSlug}`;
  const npmAlt = context.packageName === FLUX_PACKAGE_NAME ? `${context.packageName} npm version` : `${context.packageName} version`;

  const specs: PictureBadgeSpec[] = [
    {
      fileBase: npmFileBase,
      alt: npmAlt,
      href: `https://www.npmjs.com/package/${context.packageName}`,
    },
    {
      fileBase: `channel.${context.packageSlug}.stable`,
      alt: `${context.packageName} stable channel`,
      href: `https://www.npmjs.com/package/${context.packageName}`,
    },
  ];

  if (context.canaryVersionLabel) {
    specs.push({
      fileBase: `channel.${context.packageSlug}.canary`,
      alt: `${context.packageName} canary channel`,
      href: `https://www.npmjs.com/package/${context.packageName}`,
    });
  }

  specs.push(
    {
      fileBase: "license",
      alt: "License",
      href: context.licenseHref,
    },
    {
      fileBase: "maintained",
      alt: "Maintained status",
      href: `https://github.com/${context.metadata.org}/${context.metadata.repo}/commits/${context.metadata.defaultBranch}`,
    },
  );

  return specs;
}

function resolveLicenseHref(repoRoot: string, metadata: RepoMetadata, readmePath: string): string {
  const licensePath = findLicensePath(repoRoot);
  if (!licensePath) {
    return `https://github.com/${metadata.org}/${metadata.repo}/blob/${metadata.defaultBranch}/package.json`;
  }
  const relativeLicensePath = toPosix(path.relative(path.dirname(readmePath), licensePath));
  return ensureDotSlash(relativeLicensePath);
}

function normalizeVersionLabel(rawVersion: string | undefined, fallback = "v0.0.0-dev"): string {
  const formatted = formatBadgeVersion(rawVersion);
  return formatted ?? fallback;
}

async function readFluxMarkDataUri(repoRoot: string): Promise<string> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../flux-mark-badge.svg"),
    path.join(repoRoot, "packages", "brand", "src", "flux-mark-badge.svg"),
  ];
  const markPath = candidates.find((candidate) => existsSync(candidate));
  if (!markPath) {
    throw new Error("Unable to locate flux-mark-badge.svg for special flux badge generation.");
  }
  const raw = await readFile(markPath, "utf8");
  return `data:image/svg+xml;utf8,${encodeURIComponent(raw)}`;
}

async function ensureReadmeExists(readmePath: string, packageName: string): Promise<void> {
  if (existsSync(readmePath)) return;
  await writeFile(readmePath, `# ${packageName}\n`, "utf8");
}

async function resolveRepoMetadata(repoRoot: string, config: BadgeConfig): Promise<RepoMetadata> {
  const remote = runGit(repoRoot, ["remote", "get-url", "origin"]);
  const inferred = inferRepoFromRemote(remote);
  const workflowFiles = await listWorkflowFiles(repoRoot);
  const workflowFile = await resolveWorkflowFile(repoRoot, config, workflowFiles);

  const remoteHead = runGit(repoRoot, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  const defaultBranch = normalizeBranch(config.defaultBranch ?? remoteHead ?? process.env.GITHUB_REF_NAME ?? "main");

  const org = config.org ?? inferred.org;
  const repo = config.repo ?? inferred.repo;

  return {
    org,
    repo,
    defaultBranch,
    workflowFile,
    docsUrl: config.docsUrl ?? "https://flux-lang.org/docs",
    discordUrl: config.discordUrl ?? `https://github.com/${org}/${repo}/discussions`,
    securityUrl: config.securityUrl ?? `https://github.com/${org}/${repo}/security/policy`,
  };
}

export async function generateBadges(repoRoot = process.cwd()): Promise<void> {
  const config = await readBadgeConfig(repoRoot);
  const metadata = await resolveRepoMetadata(repoRoot, config);
  const workspacePackages = await collectWorkspacePackages(repoRoot, config);

  const explicitPackages = Array.isArray(config.npmPackages)
    ? config.npmPackages.filter((value): value is string => typeof value === "string" && value.length > 0)
    : [];
  const inferredPackages = workspacePackages.map((pkg) => pkg.name);
  const packageNames = explicitPackages.length > 0 ? [...explicitPackages] : [...inferredPackages];
  if (!packageNames.includes(FLUX_PACKAGE_NAME)) {
    packageNames.push(FLUX_PACKAGE_NAME);
  }

  const packageVersionByName = new Map<string, string>();
  for (const pkg of workspacePackages) {
    if (pkg.version) packageVersionByName.set(pkg.name, pkg.version);
  }

  const npmInfos = await Promise.all(packageNames.map((name) => fetchNpmInfo(name)));
  const npmInfoByName = new Map<string, DistTagInfo>(npmInfos.map((info) => [info.packageName, info]));

  const ciStatus = await resolveCiStatus(metadata);
  const license = await detectLicense(repoRoot);
  const maintained = detectMaintainedValue(repoRoot, metadata.defaultBranch);

  const outputDir = path.join(repoRoot, "badges", "generated");
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  for (const packageName of packageNames) {
    const info = npmInfoByName.get(packageName) ?? { packageName, distTags: {} };
    const slug = packageNameToSlug(packageName);
    const stableRaw = info.distTags.latest ?? packageVersionByName.get(packageName);
    const stableVersionLabel = normalizeVersionLabel(stableRaw, BADGE_FALLBACK_VALUE);

    if (packageName !== FLUX_PACKAGE_NAME) {
      await writeThemePair(outputDir, `npm.${slug}`, (theme) =>
        renderBadgeSvg({
          kind: "npm",
          label: packageName,
          value: stableVersionLabel,
          theme,
          title: `${packageName} ${stableVersionLabel}`,
        }),
      );
    }

    await writeThemePair(outputDir, `channel.${slug}.stable`, (theme) =>
      renderBadgeSvg({
        kind: "channel",
        label: "stable",
        value: stableVersionLabel,
        theme,
        title: `stable ${stableVersionLabel}`,
      }),
    );

    const canaryRaw = info.distTags.canary;
    if (typeof canaryRaw === "string" && canaryRaw.trim()) {
      const canaryVersionLabel = normalizeVersionLabel(canaryRaw, BADGE_FALLBACK_VALUE);
      await writeThemePair(outputDir, `channel.${slug}.canary`, (theme) =>
        renderBadgeSvg({
          kind: "channel",
          label: "canary",
          value: canaryVersionLabel,
          theme,
          title: `canary ${canaryVersionLabel}`,
        }),
      );
    }
  }

  await writeThemePair(outputDir, "ci", (theme) =>
    renderBadgeSvg({
      kind: "ci",
      label: "CI",
      value: ciStatus,
      theme,
      title: `CI ${ciStatus}`,
    }),
  );

  await writeThemePair(outputDir, "license", (theme) =>
    renderBadgeSvg({
      kind: "license",
      label: "License",
      value: license,
      theme,
      title: `License ${license}`,
    }),
  );

  await writeThemePair(outputDir, "docs", (theme) =>
    renderBadgeSvg({
      kind: "docs",
      label: "Docs",
      value: "site",
      theme,
      title: metadata.docsUrl,
    }),
  );

  await writeThemePair(outputDir, "discord", (theme) =>
    renderBadgeSvg({
      kind: "discord",
      label: "Community",
      value: "chat",
      theme,
      title: metadata.discordUrl,
    }),
  );

  await writeThemePair(outputDir, "security", (theme) =>
    renderBadgeSvg({
      kind: "security",
      label: "Security",
      value: "policy",
      theme,
      title: metadata.securityUrl,
    }),
  );

  await writeThemePair(outputDir, "maintained", (theme) =>
    renderBadgeSvg({
      kind: "maintained",
      label: "Maintained",
      value: maintained,
      theme,
      title: `Maintained ${maintained}`,
    }),
  );

  const fluxInfo = npmInfoByName.get(FLUX_PACKAGE_NAME) ?? (await fetchNpmInfo(FLUX_PACKAGE_NAME));
  const fluxStableRaw = fluxInfo.distTags.latest ?? packageVersionByName.get(FLUX_PACKAGE_NAME);
  const fluxVersionLabel = normalizeVersionLabel(fluxStableRaw);
  const fluxHasCanary = typeof fluxInfo.distTags.canary === "string" && fluxInfo.distTags.canary.trim().length > 0;
  const markDataUri = await readFluxMarkDataUri(repoRoot);

  await writeThemePair(outputDir, "flux-npm", (theme) =>
    renderFluxNpmBadgeSvg({
      version: fluxVersionLabel,
      markDataUri,
      theme,
      title: `${FLUX_PACKAGE_NAME} ${fluxVersionLabel}`,
    }),
  );

  const rootReadmePath = path.join(repoRoot, "README.md");
  if (existsSync(rootReadmePath)) {
    const current = await readFile(rootReadmePath, "utf8");
    const rootLicenseHref = resolveLicenseHref(repoRoot, metadata, rootReadmePath);
    const rootBlock = buildBadgeBlock(
      repoRoot,
      rootReadmePath,
      buildRootBadgeSpecs({
        repoRoot,
        metadata,
        licenseHref: rootLicenseHref,
        fluxVersionLabel,
        fluxHasCanary,
      }),
    );
    const next = upsertBadgeBlock(current, rootBlock);
    await writeIfChanged(rootReadmePath, next);
  }

  for (const pkg of workspacePackages) {
    await ensureReadmeExists(pkg.readmePath, pkg.name);
    const current = await readFile(pkg.readmePath, "utf8");
    const info = npmInfoByName.get(pkg.name) ?? (await fetchNpmInfo(pkg.name));
    const stableRaw = info.distTags.latest ?? pkg.version;
    const stableVersionLabel = normalizeVersionLabel(stableRaw, BADGE_FALLBACK_VALUE);
    const canaryVersionLabel =
      typeof info.distTags.canary === "string" && info.distTags.canary.trim()
        ? normalizeVersionLabel(info.distTags.canary, BADGE_FALLBACK_VALUE)
        : undefined;
    const licenseHref = resolveLicenseHref(repoRoot, metadata, pkg.readmePath);
    const packageBlock = buildBadgeBlock(
      repoRoot,
      pkg.readmePath,
      buildPackageBadgeSpecs({
        repoRoot,
        metadata,
        licenseHref,
        packageName: pkg.name,
        packageSlug: packageNameToSlug(pkg.name),
        stableVersionLabel,
        canaryVersionLabel,
      }),
    );
    const next = upsertBadgeBlock(current, packageBlock);
    await writeIfChanged(pkg.readmePath, next);
  }

  const generatedFiles = await readdir(outputDir);
  console.log(`Generated ${generatedFiles.length} badge SVG files in ${toPosix(path.relative(repoRoot, outputDir))}`);
}

export async function runBadgeGeneratorCli(): Promise<void> {
  await generateBadges(process.cwd());
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const currentPath = fileURLToPath(import.meta.url);

if (invokedPath === currentPath) {
  runBadgeGeneratorCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
