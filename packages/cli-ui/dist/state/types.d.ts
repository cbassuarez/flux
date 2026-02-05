export type NavItem = {
    type: "section";
    label: string;
} | {
    type: "doc";
    label: string;
    path: string;
    lastOpened?: string;
} | {
    type: "action";
    label: string;
    id: string;
};
export interface ViewerStatus {
    docstep: number;
    time: number;
    running: boolean;
    docstepMs: number;
    seed: number;
}
export type TemplateName = "demo" | "article" | "spec" | "zine" | "paper" | "blank";
export type PageSizeOption = "Letter" | "A4";
export type ThemeOption = "print" | "screen" | "both";
export type FontsPreset = "tech" | "bookish";
export type FontFallback = "system" | "none";
export interface WizardValues {
    title: string;
    name: string;
    template: TemplateName;
    page: PageSizeOption;
    theme: ThemeOption;
    fonts: FontsPreset;
    fontFallback: FontFallback;
    assets: boolean;
    chaptersEnabled: boolean;
    chapters: number;
    live: boolean;
}
export type WizardSelectKey = "template" | "page" | "theme" | "fonts" | "fontFallback" | "assets" | "chaptersEnabled" | "chapters" | "live";
export type WizardInputKey = "title" | "name";
export type WizardIndexMap = Record<WizardSelectKey, number>;
export type WizardStep = {
    kind: "select";
    key: WizardSelectKey;
    label: string;
    options: {
        label: string;
        value: any;
        hint?: string;
    }[];
} | {
    kind: "input";
    key: WizardInputKey;
    label: string;
    placeholder?: string;
} | {
    kind: "summary";
    label: string;
};
//# sourceMappingURL=types.d.ts.map