import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { Card } from "./Card.js";
import { color } from "../theme/index.js";
export function HelpOverlay({ width, version, recentsPath, backend, extraLines, }) {
    const lines = [
        "Navigation",
        "  Tab switch focus · ↑/↓ move · Enter select",
        "  Ctrl+K command palette",
        "  ? help overlay · Esc close overlays or return to Open",
        "  q quit",
        "Open picker",
        "  / focus search · Esc exit search · Backspace go up a folder",
        "Flows",
        "  Open → Doc Details → Edit / Export / Doctor / Format",
        "Diagnostics",
        "  L toggle logs",
        "Automation",
        "  --no-ui for scripts / JSON",
    ];
    return (_jsx(Box, { width: width, children: _jsxs(Card, { title: "Help", meta: version ? `Flux ${version}` : "Flux", accent: true, ruleWidth: width - 6, children: [_jsxs(Box, { flexDirection: "column", gap: 1, children: [lines.map((line, idx) => (_jsx(Text, { color: line.trim().length === 0 ? color.muted : color.fg, children: line }, `help-${idx}`))), extraLines && extraLines.length > 0 ? (_jsx(Box, { flexDirection: "column", gap: 0, children: extraLines.map((line, idx) => (_jsx(Text, { color: line.trim().length === 0 ? color.muted : color.fg, children: line }, `help-extra-${idx}`))) })) : null, backend ? _jsx(Text, { color: color.muted, children: `Backend: ${backend}` }) : null, recentsPath ? _jsx(Text, { color: color.muted, children: `Recents: ${recentsPath}` }) : null] }), _jsx(Text, { color: color.muted, children: "Press Esc to return" })] }) }));
}
//# sourceMappingURL=HelpOverlay.js.map