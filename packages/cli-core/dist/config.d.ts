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
export declare const DEFAULT_CONFIG: FluxConfig;
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
export declare function loadConfigFile(cwd: string): Promise<LoadedConfig>;
export declare function applyEnvConfig(config: FluxConfig, env: Record<string, string | undefined>): FluxConfig;
export declare function applyFlagConfig(config: FluxConfig, flags: Partial<FluxConfig>): FluxConfig;
export declare function resolveConfig(options: ResolveConfigOptions): Promise<LoadedConfig>;
export interface SetConfigResult {
    ok: boolean;
    message?: string;
    configPath?: string;
}
export declare function setConfigValue(cwd: string, key: keyof FluxConfig, value: FluxConfig[keyof FluxConfig], options?: {
    init?: boolean;
}): Promise<SetConfigResult>;
//# sourceMappingURL=config.d.ts.map