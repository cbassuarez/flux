import type { FontFallbackOption, FontsPreset, PageSizeOption, ThemeOption } from "../config.js";
export type TemplateName = "demo" | "article" | "spec" | "zine" | "paper" | "blank";
export interface TemplateOptions {
    title: string;
    page: PageSizeOption;
    theme: ThemeOption;
    fonts: FontsPreset;
    fontFallback: FontFallbackOption;
    assets: boolean;
    chapters: number;
    live: boolean;
}
export interface TemplateOutput {
    mainFlux: string;
    readme: string;
    chapters: {
        path: string;
        content: string;
    }[];
    assetsDir?: string;
}
export interface TemplateDefinition {
    name: TemplateName;
    description: string;
    build(options: TemplateOptions): TemplateOutput;
}
export declare function getTemplate(name: string): TemplateDefinition | null;
export declare function stripTrailingCommasInLists(text: string): string;
//# sourceMappingURL=templates.d.ts.map