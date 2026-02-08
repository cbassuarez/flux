import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { BADGE_ACCENTS, BADGE_FALLBACK_VALUE, BADGE_SIZE_TOKENS, BADGE_THEME_TOKENS, formatBadgeVersion, normalizeBadgeValue, } from "./badge-shared.js";
import { getBadgeIconShapes } from "./badge-icons.js";
function withAlpha(color, alpha) {
    if (!color.startsWith("#") || (color.length !== 7 && color.length !== 4)) {
        return color;
    }
    const expand = (value) => (value.length === 1 ? value.repeat(2) : value);
    const raw = color.slice(1);
    const r = parseInt(expand(raw.slice(0, raw.length === 3 ? 1 : 2)), 16);
    const gStart = raw.length === 3 ? 1 : 2;
    const g = parseInt(expand(raw.slice(gStart, gStart + (raw.length === 3 ? 1 : 2))), 16);
    const bStart = raw.length === 3 ? 2 : 4;
    const b = parseInt(expand(raw.slice(bStart, bStart + (raw.length === 3 ? 1 : 2))), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function joinClassName(...parts) {
    const value = parts.filter(Boolean).join(" ").trim();
    return value.length > 0 ? value : undefined;
}
function DefaultBadgeIcon({ kind, size, color }) {
    return (_jsx("svg", { "aria-hidden": "true", viewBox: "0 0 16 16", width: size, height: size, style: { display: "block", color }, children: getBadgeIconShapes(kind).map((shape, index) => {
            const base = {
                fill: shape.fill === "currentColor" ? color : shape.fill ?? "none",
                stroke: shape.stroke === "currentColor" ? color : shape.stroke,
                strokeWidth: shape.strokeWidth,
                strokeLinecap: shape.linecap,
                strokeLinejoin: shape.linejoin,
            };
            if (shape.type === "path") {
                return _jsx("path", { d: shape.d, ...base }, `${kind}-${index}`);
            }
            if (shape.type === "circle") {
                return _jsx("circle", { cx: shape.cx, cy: shape.cy, r: shape.r, ...base }, `${kind}-${index}`);
            }
            return (_jsx("rect", { x: shape.x, y: shape.y, width: shape.width, height: shape.height, rx: shape.rx, ...base }, `${kind}-${index}`));
        }) }));
}
export function Badge({ kind, size = "md", theme = "auto", label, value, icon, href, onClick, className, title, ariaLabel, }) {
    const normalizedValue = normalizeBadgeValue(value);
    const isLink = typeof href === "string" && href.length > 0;
    const isButton = !isLink && typeof onClick === "function";
    const interactive = isLink || isButton;
    const [isHovered, setIsHovered] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const tokens = BADGE_THEME_TOKENS[theme];
    const sizes = BADGE_SIZE_TOKENS[size];
    const accent = BADGE_ACCENTS[kind];
    const elevated = interactive && (isHovered || isFocused);
    const baseStyle = useMemo(() => ({
        display: "inline-flex",
        alignItems: "center",
        gap: sizes.gap,
        borderRadius: sizes.radius,
        border: `1px solid ${elevated ? withAlpha(accent, 0.6) : tokens.border}`,
        background: tokens.surface,
        color: tokens.text,
        fontSize: sizes.font,
        fontWeight: 600,
        lineHeight: 1.1,
        padding: `${sizes.padY}px ${sizes.padX}px`,
        whiteSpace: "nowrap",
        boxShadow: elevated ? tokens.hoverShadow : tokens.shadow,
        transform: elevated ? "translateY(-1px)" : "translateY(0)",
        transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease, background-color 140ms ease",
        textDecoration: "none",
        cursor: interactive ? "pointer" : "default",
        userSelect: "none",
        outline: isFocused ? `2px solid ${tokens.ring}` : undefined,
        outlineOffset: 2,
    }), [accent, elevated, interactive, isFocused, sizes.font, sizes.gap, sizes.padX, sizes.padY, sizes.radius, tokens]);
    const hoverHandlers = interactive
        ? {
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false),
            onFocus: () => setIsFocused(true),
            onBlur: () => setIsFocused(false),
        }
        : {};
    const computedAria = ariaLabel ?? `${label}${normalizedValue ? ` ${normalizedValue}` : ""}`;
    const computedTitle = title ?? computedAria;
    const contents = (_jsxs(_Fragment, { children: [_jsx("span", { "aria-hidden": "true", style: { display: "inline-flex", alignItems: "center" }, children: icon ?? _jsx(DefaultBadgeIcon, { kind: kind, size: sizes.icon, color: accent }) }), _jsx("span", { children: label }), normalizedValue ? (_jsxs(_Fragment, { children: [_jsx("span", { "aria-hidden": "true", style: {
                            width: 1,
                            height: Math.max(10, sizes.font + 1),
                            background: withAlpha(tokens.muted, theme === "dark" ? 0.45 : 0.35),
                        } }), _jsx("span", { style: { color: tokens.muted, fontSize: sizes.valueFont, fontWeight: 500 }, children: normalizedValue })] })) : null] }));
    if (isLink) {
        return (_jsx("a", { href: href, target: "_blank", rel: "noreferrer", className: joinClassName("flux-brand-badge", className), style: baseStyle, "aria-label": computedAria, title: computedTitle, ...hoverHandlers, children: contents }));
    }
    if (isButton) {
        return (_jsx("button", { type: "button", onClick: onClick, className: joinClassName("flux-brand-badge", className), style: baseStyle, "aria-label": computedAria, title: computedTitle, ...hoverHandlers, children: contents }));
    }
    return (_jsx("span", { className: joinClassName("flux-brand-badge", className), style: baseStyle, "aria-label": computedAria, title: computedTitle, children: contents }));
}
export function NpmBadge({ packageName, version, label, value, href, ...rest }) {
    return (_jsx(Badge, { kind: "npm", label: label ?? packageName, value: value ?? formatBadgeVersion(version), href: href ?? `https://www.npmjs.com/package/${packageName}`, ...rest }));
}
export function ChannelBadge({ channel, packageName, version, label, value, href, ...rest }) {
    return (_jsx(Badge, { kind: "channel", label: label ?? "Channel", value: value ?? formatBadgeVersion(version) ?? channel, href: href ?? (packageName ? `https://www.npmjs.com/package/${packageName}` : undefined), ...rest }));
}
export function CiBadge({ status = "unknown", label, value, repo, workflowFile, href, ...rest }) {
    const workflowHref = repo
        ? workflowFile
            ? `https://github.com/${repo}/actions/workflows/${workflowFile}`
            : `https://github.com/${repo}/actions`
        : undefined;
    return (_jsx(Badge, { kind: "ci", label: label ?? "CI", value: value ?? status, href: href ?? workflowHref, ...rest }));
}
export function LicenseBadge({ license, label, value, repo, defaultBranch = "main", href, ...rest }) {
    return (_jsx(Badge, { kind: "license", label: label ?? "License", value: value ?? license ?? "unknown", href: href ?? (repo ? `https://github.com/${repo}/blob/${defaultBranch}/LICENSE` : undefined), ...rest }));
}
export function DocsBadge({ label, value, href, ...rest }) {
    return _jsx(Badge, { kind: "docs", label: label ?? "Docs", value: value ?? "site", href: href ?? "https://flux-lang.org", ...rest });
}
export function DiscordBadge({ label, value, href, ...rest }) {
    return (_jsx(Badge, { kind: "discord", label: label ?? "Community", value: value ?? "chat", href: href ?? "https://github.com/cbassuarez/flux/discussions", ...rest }));
}
export function SecurityBadge({ label, value, repo, href, ...rest }) {
    return (_jsx(Badge, { kind: "security", label: label ?? "Security", value: value ?? "policy", href: href ?? (repo ? `https://github.com/${repo}/security/policy` : undefined), ...rest }));
}
export function MaintainedBadge({ maintained = true, label, value, href, ...rest }) {
    return (_jsx(Badge, { kind: "maintained", label: label ?? "Maintained", value: value ?? (maintained ? "yes" : "stale"), href: href, ...rest }));
}
export function fallbackBadgeValue(value) {
    return normalizeBadgeValue(value) ?? BADGE_FALLBACK_VALUE;
}
//# sourceMappingURL=badges.js.map