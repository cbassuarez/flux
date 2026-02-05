import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { color } from "../theme/index.js";
export function HelpOverlay({ width, version, recentsPath, backend, extraLines, }) {
    const sections = [
        {
            title: "Navigation",
            lines: [
                "Tab switch focus · ↑/↓ move · Enter select",
                "Ctrl+K command palette · ? help · q quit",
            ],
        },
        {
            title: "Open picker",
            lines: [
                "/ focus search · Esc exit search · Backspace go up a folder",
            ],
        },
        {
            title: "Flows",
            lines: [
                "Open → Doc Details → Edit / Export / Doctor / Format",
            ],
        },
        {
            title: "Diagnostics",
            lines: [
                "L toggle logs",
            ],
        },
        {
            title: "Automation",
            lines: [
                "--no-ui for scripts / JSON",
            ],
        },
    ];
    return (_jsx(Box, { width: width, children: _jsxs(Box, { flexDirection: "column", gap: 1, children: [sections.map((section) => (_jsxs(Box, { flexDirection: "column", gap: 0, children: [_jsx(Text, { color: color.fg, bold: true, children: section.title }), section.lines.map((line, idx) => (_jsx(Text, { color: color.muted, children: line }, `${section.title}-${idx}`)))] }, section.title))), extraLines && extraLines.length > 0 ? (_jsxs(Box, { flexDirection: "column", gap: 0, children: [_jsx(Text, { color: color.fg, bold: true, children: "Command help" }), extraLines.map((line, idx) => (_jsx(Text, { color: line.trim().length === 0 ? color.muted : color.fg, children: line }, `help-extra-${idx}`)))] })) : null, (backend || recentsPath || version) ? (_jsxs(Box, { flexDirection: "column", gap: 0, children: [_jsx(Text, { color: color.fg, bold: true, children: "Details" }), version ? _jsx(Text, { color: color.muted, children: `Flux ${version}` }) : null, backend ? _jsx(Text, { color: color.muted, children: `Backend: ${backend}` }) : null, recentsPath ? _jsx(Text, { color: color.muted, children: `Recents: ${recentsPath}` }) : null] })) : null] }) }));
}
//# sourceMappingURL=HelpOverlay.js.map