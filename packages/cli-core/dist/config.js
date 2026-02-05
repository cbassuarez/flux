import path from "node:path";
import { findGitRoot, pathExists, readJsonFile, writeJsonFile } from "./fs.js";
export const DEFAULT_CONFIG = {
    docstepMs: 1000,
    advanceTime: true,
    defaultPageSize: "Letter",
    defaultTheme: "screen",
    defaultFonts: "tech",
    defaultOutputDir: ".",
};
export async function loadConfigFile(cwd) {
    const repoRoot = await findGitRoot(cwd);
    if (!repoRoot) {
        return { config: { ...DEFAULT_CONFIG }, filePath: null, exists: false, repoRoot: null };
    }
    const filePath = path.join(repoRoot, "flux.config.json");
    const exists = await pathExists(filePath);
    if (!exists) {
        return { config: { ...DEFAULT_CONFIG }, filePath, exists: false, repoRoot };
    }
    const fileConfig = (await readJsonFile(filePath)) ?? {};
    return { config: { ...DEFAULT_CONFIG, ...fileConfig }, filePath, exists: true, repoRoot };
}
export function applyEnvConfig(config, env) {
    const next = { ...config };
    if (env.FLUX_DOCSTEP_MS) {
        const parsed = Number(env.FLUX_DOCSTEP_MS);
        if (Number.isFinite(parsed))
            next.docstepMs = parsed;
    }
    if (env.FLUX_ADVANCE_TIME) {
        next.advanceTime = env.FLUX_ADVANCE_TIME !== "0" && env.FLUX_ADVANCE_TIME !== "false";
    }
    if (env.FLUX_DEFAULT_PAGE) {
        const page = env.FLUX_DEFAULT_PAGE === "A4" ? "A4" : "Letter";
        next.defaultPageSize = page;
    }
    if (env.FLUX_DEFAULT_THEME) {
        const theme = env.FLUX_DEFAULT_THEME;
        if (theme === "print" || theme === "screen" || theme === "both") {
            next.defaultTheme = theme;
        }
    }
    if (env.FLUX_DEFAULT_FONTS) {
        const fonts = env.FLUX_DEFAULT_FONTS;
        if (fonts === "tech" || fonts === "bookish")
            next.defaultFonts = fonts;
    }
    if (env.FLUX_DEFAULT_OUTPUT_DIR) {
        next.defaultOutputDir = env.FLUX_DEFAULT_OUTPUT_DIR;
    }
    return next;
}
export function applyFlagConfig(config, flags) {
    return { ...config, ...flags };
}
export async function resolveConfig(options) {
    const { config: base, filePath, exists, repoRoot } = await loadConfigFile(options.cwd);
    const withEnv = applyEnvConfig(base, options.env ?? {});
    const withFlags = applyFlagConfig(withEnv, options.flags ?? {});
    return { config: withFlags, filePath, exists, repoRoot };
}
export async function setConfigValue(cwd, key, value, options = {}) {
    const { filePath, exists, repoRoot } = await loadConfigFile(cwd);
    if (!filePath || !repoRoot) {
        return { ok: false, message: "No git repository found; cannot write flux.config.json" };
    }
    if (!exists && !options.init) {
        return { ok: false, message: "flux.config.json does not exist; pass --init to create it" };
    }
    const current = exists ? (await readJsonFile(filePath)) ?? {} : {};
    const next = { ...current, [key]: value };
    await writeJsonFile(filePath, next);
    return { ok: true, configPath: filePath, message: "config updated" };
}
//# sourceMappingURL=config.js.map