import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { color } from "../theme/index.js";
function Chip({ label, tone }) {
    return (_jsx(Box, { marginRight: 1, children: _jsx(Text, { backgroundColor: color.panelAlt, color: tone ?? color.muted, children: ` ${label} ` }) }));
}
export function StatusChips({ backend, live, seed, docstep, time, }) {
    return (_jsxs(Box, { flexDirection: "row", flexWrap: "wrap", children: [backend ? _jsx(Chip, { label: `backend ${backend}` }) : null, typeof live === "boolean" ? _jsx(Chip, { label: live ? "live" : "idle", tone: live ? "green" : color.muted }) : null, typeof seed === "number" ? _jsx(Chip, { label: `seed ${seed}` }) : null, typeof docstep === "number" ? _jsx(Chip, { label: `docstep ${docstep}` }) : null, typeof time === "number" ? _jsx(Chip, { label: `time ${time.toFixed?.(2) ?? time}` }) : null] }));
}
//# sourceMappingURL=StatusChips.js.map