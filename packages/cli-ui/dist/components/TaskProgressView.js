import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { color } from "../theme/index.js";
function renderBar(percent, width) {
    const clamped = Math.max(0, Math.min(100, percent));
    const filled = Math.round((clamped / 100) * width);
    return `${"=".repeat(filled)}${"-".repeat(Math.max(0, width - filled))}`;
}
export function TaskProgressView({ progress }) {
    if (!progress)
        return null;
    return (_jsxs(Box, { flexDirection: "column", gap: 0, children: [_jsx(Text, { color: color.muted, children: `${progress.label} · ${progress.phase}` }), _jsxs(Text, { color: color.muted, children: [renderBar(progress.percent, 24), " ", progress.percent, "%"] })] }));
}
//# sourceMappingURL=TaskProgressView.js.map