import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { Card } from "./Card.js";
import { color } from "../theme/index.js";
export function HelpOverlay({ width, version, recentsPath, backend, extraLines, }) {
    const lines = [
        "Navigation",
        "  ↑/↓ move · Enter select · q quit",
        "  / or Ctrl+K command palette",
        "  ? help overlay · Esc close overlays",
        "Flows",
        "  New → View → Export PDF",
        "  Check → Fix → Format",
        "Viewer",
        "  p pause/resume · i interval · s seed · j docstep · e export",
        "Docs",
        "  o reveal in file explorer · y copy path",
        "Diagnostics",
        "  l toggle logs",
        "Automation",
        "  --no-ui for scripts / JSON",
    ];
    return (_jsx(Box, { width: width, children: _jsxs(Card, { title: "Help", meta: version ? `Flux ${version}` : "Flux", accent: true, ruleWidth: width - 6, children: [_jsxs(Box, { flexDirection: "column", gap: 1, children: [lines.map((line, idx) => (_jsx(Text, { color: line.trim().length === 0 ? color.muted : color.fg, children: line }, `help-${idx}`))), extraLines && extraLines.length > 0 ? (_jsx(Box, { flexDirection: "column", gap: 0, children: extraLines.map((line, idx) => (_jsx(Text, { color: line.trim().length === 0 ? color.muted : color.fg, children: line }, `help-extra-${idx}`))) })) : null, backend ? _jsx(Text, { color: color.muted, children: `Backend: ${backend}` }) : null, recentsPath ? _jsx(Text, { color: color.muted, children: `Recents: ${recentsPath}` }) : null] }), _jsx(Text, { color: color.muted, children: "Press Esc to return" })] }) }));
}
//# sourceMappingURL=HelpOverlay.js.map