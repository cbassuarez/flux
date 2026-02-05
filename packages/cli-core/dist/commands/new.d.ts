import { type CommandResult } from "../types.js";
import { type TemplateName } from "../new/templates.js";
import type { FontFallbackOption, FontsPreset, PageSizeOption, ThemeOption } from "../config.js";
export interface NewOptions {
    cwd: string;
    template: TemplateName;
    out?: string;
    page?: PageSizeOption;
    theme?: ThemeOption;
    fonts?: FontsPreset;
    fontFallback?: FontFallbackOption;
    assets?: boolean;
    chapters?: number;
    live?: boolean;
    title?: string;
}
export interface NewData {
    dir: string;
    docPath: string;
    files: string[];
}
export declare function newCommand(options: NewOptions): Promise<CommandResult<NewData>>;
//# sourceMappingURL=new.d.ts.map