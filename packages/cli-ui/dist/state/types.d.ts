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
export type TemplateName = "demo" | "article" | "spec" | "zine" | "paper";
export type PageSizeOption = "Letter" | "A4";
export type ThemeOption = "print" | "screen" | "both";
export type FontsPreset = "tech" | "bookish";
export type FontFallback = "system" | "none";
export interface WizardValues {
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
export type WizardIndexMap = Record<keyof WizardValues, number>;
export type WizardStep = {
    kind: "select";
    key: keyof WizardValues;
    label: string;
    options: {
        label: string;
        value: any;
        hint?: string;
    }[];
} | {
    kind: "summary";
    label: string;
};
//# sourceMappingURL=types.d.ts.map