import { resolveConfig, setConfigValue } from "../config.js";
import { errorResult, okResult } from "../types.js";
export async function configCommand(options) {
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
//# sourceMappingURL=config.js.map