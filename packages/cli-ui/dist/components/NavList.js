import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import path from "node:path";
import { accent, color, truncateMiddle } from "../theme/index.js";
import { Clickable } from "./Clickable.js";
const ACTION_ICONS = {
    new: "+",
    open: "⌁",
    view: "◻︎",
    export: "⇩",
    check: "✓",
    format: "≡",
    add: "+",
    settings: "⚙︎",
};
function formatRelativeTime(value) {
    if (!value)
        return "";
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed))
        return "";
    const diffMs = Date.now() - parsed;
    const diffSec = Math.max(0, Math.round(diffMs / 1000));
    if (diffSec < 60)
        return `${diffSec}s ago`;
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60)
        return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24)
        return `${diffHr}h ago`;
    const diffDay = Math.round(diffHr / 24);
    return `${diffDay}d ago`;
}
export function NavList({ items, selectedIndex, onSelect, width, maxHeight, debug, }) {
    const renderItems = items.map((item, index) => ({
        item,
        index,
        height: item.type === "doc" ? 2 : 1,
    }));
    const totalLines = renderItems.reduce((sum, entry) => sum + entry.height, 0);
    const effectiveHeight = maxHeight ?? totalLines;
    let visibleItems = renderItems;
    let showTopHint = false;
    let showBottomHint = false;
    if (totalLines > effectiveHeight) {
        const positions = [];
        let cursor = 0;
        for (const entry of renderItems) {
            positions.push(cursor);
            cursor += entry.height;
        }
        const selectedLine = positions[selectedIndex] ?? 0;
        const startLine = Math.max(0, Math.min(selectedLine - Math.floor(effectiveHeight / 3), totalLines - effectiveHeight));
        const endLine = startLine + effectiveHeight;
        visibleItems = [];
        for (let i = 0; i < renderItems.length; i += 1) {
            const entry = renderItems[i];
            const lineStart = positions[i];
            const lineEnd = lineStart + entry.height;
            if (lineEnd <= startLine)
                continue;
            if (lineStart >= endLine)
                continue;
            visibleItems.push(entry);
        }
        showTopHint = startLine > 0;
        showBottomHint = endLine < totalLines;
    }
    return (_jsxs(Box, { flexDirection: "column", gap: 1, borderStyle: debug ? "classic" : undefined, borderColor: debug ? "cyan" : undefined, children: [showTopHint ? (_jsx(Text, { color: color.muted, children: "..." })) : null, visibleItems.map(({ item, index }) => {
                if (item.type === "section") {
                    return (_jsx(Text, { color: color.muted, children: item.label }, `section-${item.label}-${index}`));
                }
                const selected = index === selectedIndex;
                const icon = item.type === "action" ? ACTION_ICONS[item.id] ?? "•" : "↺";
                const label = item.label;
                const meta = item.type === "doc"
                    ? (() => {
                        const folder = truncateMiddle(path.dirname(item.path), Math.max(10, Math.floor(width * 0.6)));
                        const rel = formatRelativeTime(item.lastOpened);
                        return rel ? `${folder} · ${rel}` : folder;
                    })()
                    : "";
                return (_jsx(Clickable, { id: `nav-${index}`, onClick: () => onSelect(index), children: _jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { flexDirection: "row", alignItems: "center", children: [_jsx(Text, { color: selected ? undefined : color.border, children: selected ? accent("▌") : " " }), _jsx(Text, { inverse: selected, color: selected ? color.fg : color.fg, children: ` ${icon} ${label}` })] }), item.type === "doc" ? (_jsxs(Box, { flexDirection: "row", children: [_jsx(Text, { color: selected ? undefined : color.border, children: selected ? accent("▌") : " " }), _jsx(Text, { inverse: selected, color: selected ? color.muted : color.muted, children: `   ${meta}` })] })) : null] }) }, `${item.type}-${item.label}-${index}`));
            }), showBottomHint ? (_jsx(Text, { color: color.muted, children: "..." })) : null] }));
}
//# sourceMappingURL=NavList.js.map