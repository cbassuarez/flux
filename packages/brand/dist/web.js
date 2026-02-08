import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId } from "react";
import { FLUX_TAGLINE, coerceVersionInfo, formatFluxVersion } from "./index.js";
export const FLUX_MARK_FAVICON_PATH = "/flux-mark-favicon.svg";
export function FluxMark({ size = 18, markPath = FLUX_MARK_FAVICON_PATH, className, title = "Flux mark", testId = "flux-mark", }) {
    const maskId = useId().replace(/:/g, "");
    return (_jsxs("svg", { role: "img", "aria-label": title, "data-testid": testId, className: joinClassName("flux-brand-mark", className), viewBox: "0 0 360 360", width: size, height: size, style: { display: "block", color: "inherit", flexShrink: 0 }, children: [_jsx("defs", { children: _jsxs("mask", { id: maskId, maskUnits: "userSpaceOnUse", maskContentUnits: "userSpaceOnUse", x: "0", y: "0", width: "360", height: "360", children: [_jsx("rect", { x: "0", y: "0", width: "360", height: "360", fill: "black" }), _jsx("image", { href: markPath, x: "0", y: "0", width: "360", height: "360", preserveAspectRatio: "xMidYMid meet" })] }) }), _jsx("rect", { x: "0", y: "0", width: "360", height: "360", fill: "currentColor", mask: `url(#${maskId})` })] }));
}
const WORDMARK_STYLE = {
    fontFamily: '"IBM Plex Mono", "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    fontStyle: "italic",
    fontWeight: 600,
    fontVariantLigatures: "contextual common-ligatures",
    fontFeatureSettings: '"liga" 1, "calt" 1',
    letterSpacing: "-0.01em",
    lineHeight: 1,
    textTransform: "lowercase",
};
export function FluxWordmark({ className }) {
    return (_jsx("span", { "data-testid": "flux-wordmark", "data-flux-ligatures": "enabled", className: joinClassName("flux-brand-wordmark", className), style: WORDMARK_STYLE, children: "flux" }));
}
const VARIANT_STYLE = {
    menu: { mark: 15, line1Size: 13, line2Size: 11, gap: 6 },
    marketing: { mark: 20, line1Size: 15, line2Size: 12, gap: 8 },
    header: { mark: 18, line1Size: 14, line2Size: 12, gap: 8 },
};
const SR_ONLY_STYLE = {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
};
export function FluxBrandHeader({ info, variant = "header", markPath, showTagline = variant !== "menu", onVersionClick, className, line1ClassName, line2ClassName, title, }) {
    const normalized = coerceVersionInfo(info);
    const sizing = VARIANT_STYLE[variant];
    const versionHandlers = onVersionClick
        ? {
            role: "button",
            tabIndex: 0,
            onMouseDown: (event) => {
                event.preventDefault();
                event.stopPropagation();
            },
            onClick: (event) => {
                event.preventDefault();
                event.stopPropagation();
                onVersionClick();
            },
            onKeyDown: (event) => {
                if (event.key !== "Enter" && event.key !== " ")
                    return;
                event.preventDefault();
                event.stopPropagation();
                onVersionClick();
            },
        }
        : {};
    return (_jsxs("div", { className: joinClassName("flux-brand-header", className), style: { display: "inline-flex", flexDirection: "column", gap: 2, lineHeight: 1.1, color: "inherit", position: "relative" }, title: title ?? (showTagline ? undefined : FLUX_TAGLINE), children: [_jsxs("div", { className: joinClassName("flux-brand-line1", line1ClassName), style: { display: "inline-flex", alignItems: "center", gap: sizing.gap, fontSize: sizing.line1Size }, children: [_jsx(FluxMark, { size: sizing.mark, markPath: markPath }), _jsx(FluxWordmark, {}), _jsx("span", { "data-testid": "flux-brand-version", className: "flux-brand-version", style: {
                            color: "rgba(80, 92, 116, 0.95)",
                            border: "1px solid rgba(133, 146, 173, 0.45)",
                            borderRadius: 999,
                            padding: "1px 7px",
                            fontSize: Math.max(10, sizing.line2Size),
                            fontWeight: 500,
                            lineHeight: 1.2,
                            cursor: onVersionClick ? "pointer" : "default",
                        }, ...versionHandlers, children: formatFluxVersion(normalized.version) })] }), showTagline ? (_jsx("div", { className: joinClassName("flux-brand-line2", line2ClassName), style: {
                    color: "rgba(94, 106, 130, 0.95)",
                    fontSize: sizing.line2Size,
                    lineHeight: 1.2,
                }, children: normalized.tagline })) : (_jsx("span", { className: "flux-brand-line2-sr", style: SR_ONLY_STYLE, children: normalized.tagline }))] }));
}
function joinClassName(...values) {
    const joined = values.filter(Boolean).join(" ").trim();
    return joined.length > 0 ? joined : undefined;
}
//# sourceMappingURL=web.js.map