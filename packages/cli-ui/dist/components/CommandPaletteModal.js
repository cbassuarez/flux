import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { accent, color } from "../theme/index.js";
import { InputLine } from "./InputLine.js";
export function CommandPaletteModal({ query, groups, selectedId, width, debug, }) {
    const lineWidth = Math.max(0, width);
    const contentWidth = Math.max(0, lineWidth - 2);
    const padLine = (value) => {
        if (value.length >= lineWidth)
            return value.slice(0, lineWidth);
        return `${value}${" ".repeat(lineWidth - value.length)}`;
    };
    const truncate = (value, max) => {
        if (value.length <= max)
            return value;
        if (max <= 3)
            return value.slice(0, max);
        return `${value.slice(0, max - 3)}...`;
    };
    const renderItemLine = (label, hint, selected) => {
        let labelText = label;
        let hintText = hint ? ` ${hint}` : "";
        const available = Math.max(0, contentWidth);
        if (labelText.length + hintText.length > available) {
            const maxLabel = Math.max(0, available - hintText.length);
            labelText = truncate(labelText, maxLabel);
            const total = labelText.length + hintText.length;
            if (total > available) {
                const maxHint = Math.max(0, available - labelText.length);
                hintText = truncate(hintText, maxHint);
            }
        }
        const padding = " ".repeat(Math.max(0, available - (labelText.length + hintText.length)));
        return (_jsxs(Text, { backgroundColor: selected ? color.panel : color.panelAlt, color: selected ? color.fg : color.fg, bold: selected, inverse: selected, children: [selected ? accent("▌") : " ", " ", labelText, hintText ? _jsx(Text, { color: color.muted, children: hintText }) : null, padding] }));
    };
    return (_jsx(Box, { width: width, children: _jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsxs(Box, { flexDirection: "row", gap: 1, children: [_jsx(Text, { color: color.muted, children: "Search" }), _jsx(InputLine, { value: query, placeholder: "Type to filter", focused: true })] }), _jsx(Box, { flexDirection: "column", gap: 1, children: groups.length === 0 ? (_jsx(Text, { backgroundColor: color.panelAlt, color: color.muted, children: padLine("No matches") })) : (groups.map((group) => (_jsxs(Box, { flexDirection: "column", gap: 0, children: [_jsx(Text, { backgroundColor: color.panelAlt, color: color.muted, bold: true, children: padLine(group.group) }), group.items.map((item) => {
                                const selected = item.id === selectedId;
                                return (_jsx(Box, { width: lineWidth, children: renderItemLine(item.label, item.hint, selected) }, item.id));
                            })] }, group.group)))) })] }) }));
}
//# sourceMappingURL=CommandPaletteModal.js.map