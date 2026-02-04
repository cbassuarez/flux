import { resolveConfig, setConfigValue, type FluxConfig } from "../config.js";
import { errorResult, okResult, type CommandResult } from "../types.js";

export type ConfigAction = "view" | "set";

export interface ConfigOptions {
  cwd: string;
  action: ConfigAction;
  key?: keyof FluxConfig;
  value?: FluxConfig[keyof FluxConfig];
  init?: boolean;
  flags?: Partial<FluxConfig>;
  env?: Record<string, string | undefined>;
}

export interface ConfigData {
  config: FluxConfig;
  filePath: string | null;
  exists: boolean;
}

export async function configCommand(options: ConfigOptions): Promise<CommandResult<ConfigData>> {
  if (options.action === "view") {
    const resolved = await resolveConfig({ cwd: options.cwd, flags: options.flags, env: options.env });
    return okResult({ config: resolved.config, filePath: resolved.filePath, exists: resolved.exists });
  }

  if (!options.key) {
    return errorResult("flux config set: key is required", "MISSING_KEY");
  }
  if (options.value === undefined) {
    return errorResult("flux config set: value is required", "MISSING_VALUE");
  }

  const result = await setConfigValue(options.cwd, options.key, options.value, { init: options.init });
  if (!result.ok) {
    return errorResult(result.message ?? "failed to set config", "SET_FAILED");
  }

  const resolved = await resolveConfig({ cwd: options.cwd, flags: options.flags, env: options.env });
  return okResult({ config: resolved.config, filePath: resolved.filePath, exists: true });
}
