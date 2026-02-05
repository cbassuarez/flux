import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import path from "node:path";
import { Card } from "../components/Card.js";
import { Button } from "../components/Button.js";
import { Clickable } from "../components/Clickable.js";
import { InputLine } from "../components/InputLine.js";
import { color, truncateMiddle } from "../theme/index.js";
function limitList(items, selectedIndex, maxItems) {
    if (items.length <= maxItems) {
        return { items, showTop: false, showBottom: false, offset: 0 };
    }
    const safeIndex = Math.max(0, Math.min(selectedIndex, items.length - 1));
    const start = Math.max(0, Math.min(safeIndex - Math.floor(maxItems / 2), items.length - maxItems));
    const end = start + maxItems;
    return {
        items: items.slice(start, end),
        showTop: start > 0,
        showBottom: end < items.length,
        offset: start,
    };
}
export function OpenScreen({ width, query, showAll, rootDir, results, selectedIndex, folders, folderIndex, activeList, pinnedDirs, recentDirs, isPinned, indexing, truncated, preview, searchFocused, onToggleShowAll, onOpenSelected, onSelectResult, onSelectFolder, onSelectPinned, onSelectRecent, onTogglePin, onFocusSearch, onFocusResults, debug, }) {
    const resultsList = limitList(results, selectedIndex, 8);
    const foldersList = limitList(folders.map((entry, idx) => ({ id: `${entry}-${idx}`, label: path.basename(entry), path: entry })), folderIndex, 6);
    const breadcrumb = truncateMiddle(rootDir, Math.max(18, width - 14));
    return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [truncated ? (_jsx(Card, { title: "Index limit reached", meta: "", ruleWidth: width - 6, debug: debug, children: _jsx(Text, { color: color.muted, children: "Too many files; narrow search or browse folders." }) })) : null, _jsxs(Card, { title: "Open", meta: indexing ? "indexing…" : `${results.length} results`, accent: true, ruleWidth: width - 6, debug: debug, children: [_jsxs(Box, { flexDirection: "row", gap: 1, alignItems: "center", children: [_jsx(Text, { color: color.muted, children: "Search" }), _jsx(Clickable, { id: "open-search-focus", onClick: onFocusSearch, priority: 2, children: _jsx(InputLine, { value: query, placeholder: "Type to filter", focused: searchFocused }) }), _jsx(Clickable, { id: "toggle-filter", onClick: onToggleShowAll, priority: 1, children: _jsx(Text, { color: color.muted, children: showAll ? "Filter: all" : "Filter: *.flux" }) })] }), _jsx(Clickable, { id: "open-results-focus", onClick: onFocusResults, priority: 0, children: _jsxs(Box, { flexDirection: "column", gap: 0, children: [_jsx(Text, { color: color.muted, children: activeList === "results" ? "Results" : "Results (inactive)" }), results.length === 0 ? (_jsx(Text, { color: color.muted, children: "No matches yet." })) : (_jsxs(Box, { flexDirection: "column", gap: 0, children: [resultsList.showTop ? _jsx(Text, { color: color.muted, children: "\u2026" }) : null, resultsList.items.map((item, idx) => {
                                            const absoluteIndex = resultsList.offset + idx;
                                            const selected = activeList === "results" && absoluteIndex === selectedIndex;
                                            return (_jsx(Clickable, { id: `open-result-${item.id}`, onClick: () => onSelectResult(absoluteIndex), priority: 1, children: _jsxs(Text, { inverse: selected, color: selected ? color.fg : color.fg, children: [`${selected ? ">" : " "} ${item.label}`, item.meta ? ` ${item.meta}` : ""] }) }, item.id));
                                        }), resultsList.showBottom ? _jsx(Text, { color: color.muted, children: "\u2026" }) : null] })), _jsx(Box, { marginTop: 1, children: _jsx(Button, { id: "open-selected", label: "Open selected", icon: "\u21A9", onClick: onOpenSelected }) })] }) }), _jsxs(Box, { flexDirection: "column", gap: 0, children: [_jsx(Text, { color: color.muted, children: "Pinned / Recent directories" }), _jsx(Clickable, { id: "toggle-pin", onClick: onTogglePin, priority: 1, children: _jsx(Text, { color: color.muted, children: isPinned ? "Unpin current directory" : "Pin current directory" }) }), pinnedDirs.length === 0 && recentDirs.length === 0 ? (_jsx(Text, { color: color.muted, children: "No pinned or recent directories yet." })) : (_jsxs(Box, { flexDirection: "column", gap: 0, children: [pinnedDirs.map((dir) => (_jsx(Clickable, { id: `pin-${dir}`, onClick: () => onSelectPinned(dir), priority: 1, children: _jsx(Text, { color: color.fg, children: `★ ${truncateMiddle(dir, Math.max(10, width - 10))}` }) }, `pin-${dir}`))), recentDirs.map((dir) => (_jsx(Clickable, { id: `recent-${dir}`, onClick: () => onSelectRecent(dir), priority: 1, children: _jsx(Text, { color: color.muted, children: `↺ ${truncateMiddle(dir, Math.max(10, width - 10))}` }) }, `recent-${dir}`)))] }))] }), _jsxs(Box, { flexDirection: "column", gap: 0, children: [_jsx(Text, { color: color.muted, children: activeList === "folders" ? "Browse" : "Browse (inactive)" }), _jsx(Text, { color: color.muted, children: breadcrumb }), folders.length === 0 ? (_jsx(Text, { color: color.muted, children: "No subfolders." })) : (_jsxs(Box, { flexDirection: "column", gap: 0, children: [foldersList.showTop ? _jsx(Text, { color: color.muted, children: "\u2026" }) : null, foldersList.items.map((item, idx) => {
                                        const absoluteIndex = foldersList.offset + idx;
                                        const selected = activeList === "folders" && absoluteIndex === folderIndex;
                                        return (_jsx(Clickable, { id: `open-folder-${item.id}`, onClick: () => onSelectFolder(absoluteIndex), priority: 1, children: _jsx(Text, { inverse: selected, color: selected ? color.fg : color.fg, children: `${selected ? ">" : " "} ${item.label}/` }) }, item.id));
                                    }), foldersList.showBottom ? _jsx(Text, { color: color.muted, children: "\u2026" }) : null] })), _jsx(Text, { color: color.muted, children: "Backspace to go up" })] })] }), _jsx(Card, { title: "Preview", meta: "", ruleWidth: width - 6, debug: debug, children: preview ? (_jsxs(Box, { flexDirection: "column", gap: 0, children: [_jsx(Text, { color: color.fg, children: preview.title ?? path.basename(preview.filePath) }), _jsx(Text, { color: color.muted, children: truncateMiddle(preview.filePath, Math.max(12, width - 8)) }), preview.modified ? _jsxs(Text, { color: color.muted, children: ["Modified: ", preview.modified] }) : null, preview.size ? _jsxs(Text, { color: color.muted, children: ["Size: ", preview.size] }) : null, preview.status ? _jsxs(Text, { color: color.muted, children: ["Parse: ", preview.status] }) : null] })) : (_jsx(Text, { color: color.muted, children: "Select a file to see details." })) })] }));
}
//# sourceMappingURL=OpenScreen.js.map