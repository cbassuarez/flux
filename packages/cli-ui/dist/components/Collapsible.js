import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { color } from "../theme/index.js";
import { Clickable } from "./Clickable.js";
export function Collapsible({ id, title, summary, isOpen, onToggle, children, }) {
    return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsx(Clickable, { id: id, onClick: onToggle, priority: 1, children: _jsxs(Box, { flexDirection: "row", justifyContent: "space-between", children: [_jsx(Text, { color: color.fg, children: `${isOpen ? "▾" : "▸"} ${title}` }), summary ? _jsx(Text, { color: color.muted, children: summary }) : null] }) }), isOpen ? (_jsx(Box, { flexDirection: "column", gap: 1, children: children })) : null] }));
}
//# sourceMappingURL=Collapsible.js.map