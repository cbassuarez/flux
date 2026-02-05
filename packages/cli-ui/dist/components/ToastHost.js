import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { color } from "../theme/index.js";
import { Spinner } from "./Spinner.js";
function renderBar(percent, width) {
    const clamped = Math.max(0, Math.min(100, percent));
    const filled = Math.round((clamped / 100) * width);
    return `${"=".repeat(filled)}${"-".repeat(Math.max(0, width - filled))}`;
}
export function ToastHost({ toasts, busy, progress, }) {
    if (!busy && !progress && toasts.length === 0)
        return null;
    return (_jsxs(Box, { flexDirection: "column", alignItems: "flex-end", width: "100%", gap: 1, children: [busy ? (_jsxs(Box, { flexDirection: "row", gap: 1, children: [_jsx(Text, { color: color.muted, children: _jsx(Spinner, {}) }), _jsx(Text, { color: color.muted, children: busy })] })) : null, progress ? (_jsxs(Box, { flexDirection: "column", alignItems: "flex-end", children: [_jsx(Text, { color: color.muted, children: `${progress.label} · ${progress.phase}` }), _jsxs(Text, { color: color.muted, children: [renderBar(progress.percent, 24), " ", progress.percent, "%"] })] })) : null, toasts.map((toast) => {
                const tone = toast.kind === "error" ? color.danger : toast.kind === "success" ? "green" : color.muted;
                return (_jsx(Text, { color: tone, children: toast.message }, toast.id));
            })] }));
}
//# sourceMappingURL=ToastHost.js.map