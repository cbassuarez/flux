import type { FluxVersionInfo } from "@flux-lang/brand";
export interface CliUiOptions {
    cwd: string;
    mode?: "new";
    initialArgs?: string[];
    detach?: boolean;
    helpCommand?: string;
    versionInfo: FluxVersionInfo;
    showVersionModal?: boolean;
}
export declare function runCliUi(options: CliUiOptions): Promise<void>;
export * from "./state/dashboard-machine.js";
//# sourceMappingURL=index.d.ts.map