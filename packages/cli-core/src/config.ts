import path from "node:path";
import { findGitRoot, pathExists, readJsonFile, writeJsonFile } from "./fs.js";

export type PageSizeOption = "Letter" | "A4";
export type ThemeOption = "print" | "screen" | "both";
export type FontsPreset = "tech" | "bookish";
export type FontFallbackOption = "system" | "none";

export interface FluxConfig {
  docstepMs: number;
  advanceTime: boolean;
  defaultPageSize: PageSizeOption;
  defaultTheme: ThemeOption;
  defaultFonts: FontsPreset;
  defaultOutputDir: string;
}

export const DEFAULT_CONFIG: FluxConfig = {
  docstepMs: 1000,
  advanceTime: true,
  defaultPageSize: "Letter",
  defaultTheme: "screen",
  defaultFonts: "tech",
  defaultOutputDir: ".",
};

export interface LoadedConfig {
  config: FluxConfig;
  filePath: string | null;
  exists: boolean;
  repoRoot: string | null;
}

export interface ResolveConfigOptions {
  cwd: string;
  flags?: Partial<FluxConfig>;
  env?: Record<string, string | undefined>;
}

export async function loadConfigFile(cwd: string): Promise<LoadedConfig> {
  const repoRoot = await findGitRoot(cwd);
  if (!repoRoot) {
    return { config: { ...DEFAULT_CONFIG }, filePath: null, exists: false, repoRoot: null };
  }
  const filePath = path.join(repoRoot, "flux.config.json");
  const exists = await pathExists(filePath);
  if (!exists) {
    return { config: { ...DEFAULT_CONFIG }, filePath, exists: false, repoRoot };
  }
  const fileConfig = (await readJsonFile<Partial<FluxConfig>>(filePath)) ?? {};
  return { config: { ...DEFAULT_CONFIG, ...fileConfig }, filePath, exists: true, repoRoot };
}

export function applyEnvConfig(config: FluxConfig, env: Record<string, string | undefined>): FluxConfig {
  const next = { ...config };
  if (env.FLUX_DOCSTEP_MS) {
    const parsed = Number(env.FLUX_DOCSTEP_MS);
    if (Number.isFinite(parsed)) next.docstepMs = parsed;
  }
  if (env.FLUX_ADVANCE_TIME) {
    next.advanceTime = env.FLUX_ADVANCE_TIME !== "0" && env.FLUX_ADVANCE_TIME !== "false";
  }
  if (env.FLUX_DEFAULT_PAGE) {
    const page = env.FLUX_DEFAULT_PAGE === "A4" ? "A4" : "Letter";
    next.defaultPageSize = page;
  }
  if (env.FLUX_DEFAULT_THEME) {
    const theme = env.FLUX_DEFAULT_THEME as ThemeOption;
    if (theme === "print" || theme === "screen" || theme === "both") {
      next.defaultTheme = theme;
    }
  }
  if (env.FLUX_DEFAULT_FONTS) {
    const fonts = env.FLUX_DEFAULT_FONTS as FontsPreset;
    if (fonts === "tech" || fonts === "bookish") next.defaultFonts = fonts;
  }
  if (env.FLUX_DEFAULT_OUTPUT_DIR) {
    next.defaultOutputDir = env.FLUX_DEFAULT_OUTPUT_DIR;
  }
  return next;
}

export function applyFlagConfig(config: FluxConfig, flags: Partial<FluxConfig>): FluxConfig {
  return { ...config, ...flags };
}

export async function resolveConfig(options: ResolveConfigOptions): Promise<LoadedConfig> {
  const { config: base, filePath, exists, repoRoot } = await loadConfigFile(options.cwd);
  const withEnv = applyEnvConfig(base, options.env ?? {});
  const withFlags = applyFlagConfig(withEnv, options.flags ?? {});
  return { config: withFlags, filePath, exists, repoRoot };
}

export interface SetConfigResult {
  ok: boolean;
  message?: string;
  configPath?: string;
}

export async function setConfigValue(
  cwd: string,
  key: keyof FluxConfig,
  value: FluxConfig[keyof FluxConfig],
  options: { init?: boolean } = {},
): Promise<SetConfigResult> {
  const { filePath, exists, repoRoot } = await loadConfigFile(cwd);
  if (!filePath || !repoRoot) {
    return { ok: false, message: "No git repository found; cannot write flux.config.json" };
  }
  if (!exists && !options.init) {
    return { ok: false, message: "flux.config.json does not exist; pass --init to create it" };
  }
  const current = exists ? (await readJsonFile<Partial<FluxConfig>>(filePath)) ?? {} : {};
  const next = { ...current, [key]: value } as Partial<FluxConfig>;
  await writeJsonFile(filePath, next);
  return { ok: true, configPath: filePath, message: "config updated" };
}
