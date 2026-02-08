export declare const badgeIds: {
    readonly npm: "npm";
    readonly channel: "channel";
    readonly ci: "ci";
    readonly license: "license";
    readonly docs: "docs";
    readonly discord: "discord";
    readonly security: "security";
    readonly maintained: "maintained";
};
export type BadgeKind = keyof typeof badgeIds;
export declare const badgeKinds: BadgeKind[];
export declare const kinds: BadgeKind[];
export type BadgeSize = "sm" | "md" | "lg";
export type BadgeTheme = "auto" | "light" | "dark" | "blueprint";
export type BadgeReleaseChannel = "stable" | "nightly" | "canary";
export type BadgeThemeTokens = {
    surface: string;
    border: string;
    text: string;
    muted: string;
    accent: string;
    ring: string;
    shadow: string;
    hoverShadow: string;
};
export type BadgeSizeTokens = {
    icon: number;
    font: number;
    valueFont: number;
    gap: number;
    radius: number;
    padX: number;
    padY: number;
};
export declare const BADGE_THEME_TOKENS: Record<BadgeTheme, BadgeThemeTokens>;
export declare const BADGE_SIZE_TOKENS: Record<BadgeSize, BadgeSizeTokens>;
export declare const BADGE_ACCENTS: Record<BadgeKind, string>;
export declare const BADGE_FALLBACK_VALUE = "n/a";
export declare function formatBadgeVersion(version: string | undefined): string | undefined;
export declare function packageNameToSlug(packageName: string): string;
export declare function normalizeBadgeValue(value: string | undefined): string | undefined;
//# sourceMappingURL=badge-shared.d.ts.map