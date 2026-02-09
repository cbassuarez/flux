import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FLUX_VERSION } from "../config/fluxMeta.js";
const fluxBadgeMark = new URL("../flux-mark-badge.svg", import.meta.url).toString();
export function FluxBadge({ className, version }) {
    const baseClasses = "inline-flex items-center gap-2 rounded-lg border border-slate-200 " +
        "bg-white/90 px-3 py-1 text-xs font-medium text-slate-900 " +
        "shadow-sm transition hover:shadow-md hover:border-sky-200 hover:bg-white " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 " +
        "focus-visible:ring-offset-2 focus-visible:ring-offset-white";
    const mergedClassName = className ? `${baseClasses} ${className}` : baseClasses;
    const rawVersion = (version ?? FLUX_VERSION ?? "").toString();
    const versionLabel = rawVersion && rawVersion.startsWith("v")
        ? rawVersion
        : rawVersion
            ? `v${rawVersion}`
            : "v0.0.0-dev";
    return (_jsxs("a", { href: "https://www.npmjs.com/package/@flux-lang/flux", target: "_blank", rel: "noreferrer", className: mergedClassName, "aria-label": `@flux-lang/flux package (version ${versionLabel})`, children: [_jsx("img", { src: fluxBadgeMark, alt: "Flux mark", className: "h-4 w-auto" }), _jsx("span", { className: "uppercase tracking-wide", children: "@flux-lang/flux" }), _jsx("span", { className: "text-[11px] text-slate-500", children: versionLabel })] }));
}
export const FLUX_BADGE_BASE_CLASSES = "inline-flex items-center gap-2 rounded-lg border border-slate-200 " +
    "bg-white/90 px-3 py-1 text-xs font-medium text-slate-900 " +
    "shadow-sm transition hover:shadow-md hover:border-sky-200 hover:bg-white " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-white";
//# sourceMappingURL=FluxBadge.js.map