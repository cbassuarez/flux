export const badgeIds = {
  npm: "npm",
  channel: "channel",
  ci: "ci",
  license: "license",
  docs: "docs",
  discord: "discord",
  security: "security",
  maintained: "maintained",
} as const;

export type BadgeKind = keyof typeof badgeIds;
export const badgeKinds: BadgeKind[] = Object.keys(badgeIds) as BadgeKind[];
export const kinds: BadgeKind[] = badgeKinds;

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

export const BADGE_THEME_TOKENS: Record<BadgeTheme, BadgeThemeTokens> = {
  auto: {
    surface: "var(--surface-1, rgba(255, 255, 255, 0.92))",
    border: "var(--border, #e2e8f0)",
    text: "var(--fg, #0f172a)",
    muted: "var(--muted, #475569)",
    accent: "var(--accent, #06b6d4)",
    ring: "var(--ring, #38bdf8)",
    shadow: "0 1px 2px rgba(15, 23, 42, 0.12)",
    hoverShadow: "0 8px 18px rgba(15, 23, 42, 0.18)",
  },
  light: {
    surface: "rgba(255, 255, 255, 0.92)",
    border: "#e2e8f0",
    text: "#0f172a",
    muted: "#475569",
    accent: "#06b6d4",
    ring: "#38bdf8",
    shadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
    hoverShadow: "0 8px 18px rgba(15, 23, 42, 0.14)",
  },
  dark: {
    surface: "rgba(15, 23, 42, 0.88)",
    border: "rgba(148, 163, 184, 0.35)",
    text: "#e2e8f0",
    muted: "#94a3b8",
    accent: "#22d3ee",
    ring: "#22d3ee",
    shadow: "0 1px 2px rgba(2, 6, 23, 0.45)",
    hoverShadow: "0 8px 18px rgba(2, 6, 23, 0.62)",
  },
  blueprint: {
    surface: "rgba(15, 36, 59, 0.92)",
    border: "rgba(90, 119, 148, 0.55)",
    text: "#e2f0ff",
    muted: "#9fb6d3",
    accent: "#2dd4ff",
    ring: "#5ac8fa",
    shadow: "0 1px 2px rgba(7, 24, 41, 0.45)",
    hoverShadow: "0 8px 18px rgba(7, 24, 41, 0.64)",
  },
};

export const BADGE_SIZE_TOKENS: Record<BadgeSize, BadgeSizeTokens> = {
  sm: { icon: 10, font: 10, valueFont: 10, gap: 5, radius: 8, padX: 8, padY: 2 },
  md: { icon: 11, font: 11, valueFont: 11, gap: 6, radius: 9, padX: 10, padY: 4 },
  lg: { icon: 12, font: 12, valueFont: 12, gap: 7, radius: 10, padX: 12, padY: 6 },
};

export const BADGE_ACCENTS: Record<BadgeKind, string> = {
  npm: "#0ea5e9",
  channel: "#22c55e",
  ci: "#06b6d4",
  license: "#22c55e",
  docs: "#0284c7",
  discord: "#14b8a6",
  security: "#f59e0b",
  maintained: "#10b981",
};

export const BADGE_FALLBACK_VALUE = "n/a";

export function formatBadgeVersion(version: string | undefined): string | undefined {
  if (!version) return undefined;
  const normalized = version.trim().replace(/^v+/i, "");
  if (!normalized) return undefined;
  return `v${normalized}`;
}

export function packageNameToSlug(packageName: string): string {
  const tail = packageName.includes("/") ? packageName.split("/").at(-1) ?? packageName : packageName;
  return tail.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
}

export function normalizeBadgeValue(value: string | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}
