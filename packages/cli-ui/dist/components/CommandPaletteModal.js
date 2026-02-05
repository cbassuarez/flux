import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { Card } from "./Card.js";
import { color } from "../theme/index.js";
import { InputLine } from "./InputLine.js";
export function CommandPaletteModal({ query, groups, selectedId, width, debug, }) {
    return (_jsx(Box, { width: width, children: _jsxs(Card, { title: "Command Palette", meta: "/", accent: true, ruleWidth: width - 6, debug: debug, children: [_jsxs(Box, { flexDirection: "row", gap: 1, children: [_jsx(Text, { color: color.muted, children: "Search" }), _jsx(InputLine, { value: query, placeholder: "Type to filter" })] }), _jsx(Box, { flexDirection: "column", gap: 1, children: groups.length === 0 ? (_jsx(Text, { color: color.muted, children: "No matches" })) : (groups.map((group) => (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: color.muted, children: group.group }), group.items.map((item) => {
                                const selected = item.id === selectedId;
                                return (_jsxs(Text, { inverse: selected, color: selected ? color.fg : color.fg, children: [`  ${item.label}`, item.hint ? ` ${item.hint}` : ""] }, item.id));
                            })] }, group.group)))) }), _jsx(Text, { color: color.muted, children: "Enter to run \u00B7 Esc to close" })] }) }));
}
//# sourceMappingURL=CommandPaletteModal.js.map