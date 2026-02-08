export const FLUX_BADGE_BASE_CLASSES =
  "inline-flex items-center gap-2 rounded-lg border border-slate-200 " +
  "bg-white/90 px-3 py-1 text-xs font-medium text-slate-900 " +
  "shadow-sm transition hover:shadow-md hover:border-sky-200 hover:bg-white " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-white";

const FLUX_BADGE_PACKAGE = "@flux-lang/flux";
const FLUX_BADGE_HREF = "https://www.npmjs.com/package/@flux-lang/flux";
const FLUX_BADGE_FALLBACK_VERSION = "v0.0.0-dev";
const FLUX_BADGE_MARK_SRC = new URL("./flux-mark-badge.svg", import.meta.url).toString();

export type FluxBadgeTheme = "light" | "dark" | "blueprint";

export type FluxBadgeProps = {
  className?: string;
  theme?: FluxBadgeTheme;
  version?: string;
};

function readFluxVersionFromEnv(): string | undefined {
  if (typeof process === "undefined") return undefined;
  return process.env?.FLUX_VERSION;
}

function formatFluxBadgeVersion(rawVersion: string | undefined): string {
  const raw = (rawVersion ?? "").toString().trim();
  if (raw.length === 0) return FLUX_BADGE_FALLBACK_VERSION;
  return raw.startsWith("v") ? raw : `v${raw}`;
}

function resolveThemeClasses(theme: FluxBadgeTheme | undefined): string | undefined {
  if (theme === "dark") {
    return "border-slate-700 bg-slate-900/90 text-slate-100 hover:border-sky-400/50 hover:bg-slate-900 focus-visible:ring-sky-400 focus-visible:ring-offset-slate-900";
  }
  if (theme === "blueprint") {
    return "border-sky-900/40 bg-sky-950/85 text-sky-100 hover:border-cyan-300/60 hover:bg-sky-950 focus-visible:ring-cyan-300 focus-visible:ring-offset-sky-950";
  }
  return undefined;
}

export function FluxBadge({ className, theme, version }: FluxBadgeProps) {
  const themeClasses = resolveThemeClasses(theme);
  const mergedClassName = [FLUX_BADGE_BASE_CLASSES, themeClasses, className].filter(Boolean).join(" ");
  const versionLabel = formatFluxBadgeVersion(version ?? readFluxVersionFromEnv());

  return (
    <a
      href={FLUX_BADGE_HREF}
      target="_blank"
      rel="noreferrer"
      className={mergedClassName}
      aria-label={`${FLUX_BADGE_PACKAGE} package (version ${versionLabel})`}
    >
      <img src={FLUX_BADGE_MARK_SRC} alt="Flux mark" className="h-4 w-auto" />
      <span className="uppercase tracking-wide">{FLUX_BADGE_PACKAGE}</span>
      <span className="text-[11px] text-slate-500">{versionLabel}</span>
    </a>
  );
}
