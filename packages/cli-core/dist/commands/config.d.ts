import { type FluxConfig } from "../config.js";
import { type CommandResult } from "../types.js";
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
export declare function configCommand(options: ConfigOptions): Promise<CommandResult<ConfigData>>;
//# sourceMappingURL=config.d.ts.map