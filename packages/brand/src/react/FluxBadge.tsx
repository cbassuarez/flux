import type { ReactNode } from "react";
import { FLUX_VERSION } from "../config/fluxMeta.js";

const fluxBadgeMark = new URL("../flux-mark-badge.svg", import.meta.url).toString();

export type FluxBadgeProps = {
  className?: string;
  children?: ReactNode; // kept for future flexibility (not required)
  version?: string;
};

export function FluxBadge({ className, version }: FluxBadgeProps) {
  const baseClasses =
    "inline-flex items-center gap-2 rounded-lg border border-slate-200 " +
    "bg-white/90 px-3 py-1 text-xs font-medium text-slate-900 " +
    "shadow-sm transition hover:shadow-md hover:border-sky-200 hover:bg-white " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-white";

  const mergedClassName = className ? `${baseClasses} ${className}` : baseClasses;

  const rawVersion = (version ?? FLUX_VERSION ?? "").toString();
  const versionLabel =
    rawVersion && rawVersion.startsWith("v")
      ? rawVersion
      : rawVersion
        ? `v${rawVersion}`
        : "v0.0.0-dev";

  return (
    <a
      href="https://www.npmjs.com/package/@flux-lang/flux"
      target="_blank"
      rel="noreferrer"
      className={mergedClassName}
      aria-label={`@flux-lang/flux package (version ${versionLabel})`}
    >
      <img src={fluxBadgeMark} alt="Flux mark" className="h-4 w-auto" />
      <span className="uppercase tracking-wide">@flux-lang/flux</span>
      <span className="text-[11px] text-slate-500">{versionLabel}</span>
    </a>
  );
}

export const FLUX_BADGE_BASE_CLASSES =
  "inline-flex items-center gap-2 rounded-lg border border-slate-200 " +
  "bg-white/90 px-3 py-1 text-xs font-medium text-slate-900 " +
  "shadow-sm transition hover:shadow-md hover:border-sky-200 hover:bg-white " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-white";
