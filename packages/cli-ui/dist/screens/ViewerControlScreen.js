import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import path from "node:path";
import { Card } from "../components/Card.js";
import { StatusChips } from "../components/StatusChips.js";
import { color, truncateMiddle } from "../theme/index.js";
export function ViewerControlScreen({ width, activeDoc, viewerUrl, viewerStatus, streamOk, backend, debug, }) {
    const docName = activeDoc ? path.basename(activeDoc) : "Viewer";
    const docPath = activeDoc ? truncateMiddle(activeDoc, Math.max(20, width - 12)) : "";
    return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsxs(Card, { title: docName, meta: _jsx(Text, { color: streamOk ? "green" : color.muted, children: streamOk ? "● connected" : "○ idle" }), accent: true, ruleWidth: width - 6, debug: debug, children: [docPath ? _jsx(Text, { color: color.muted, children: docPath }) : null, viewerUrl ? _jsx(Text, { color: color.muted, children: truncateMiddle(viewerUrl, Math.max(20, width - 12)) }) : null, _jsx(StatusChips, { backend: backend, live: viewerStatus?.running ?? false, seed: viewerStatus?.seed, docstep: viewerStatus?.docstep, time: viewerStatus?.time })] }), _jsxs(Card, { title: "Controls", meta: "", ruleWidth: width - 6, debug: debug, children: [_jsx(Text, { color: color.muted, children: "p pause/resume \u00B7 i interval \u00B7 s seed \u00B7 j docstep \u00B7 e export" }), _jsxs(Text, { color: color.muted, children: ["Interval: ", viewerStatus?.docstepMs ?? 1000, "ms"] })] })] }));
}
//# sourceMappingURL=ViewerControlScreen.js.map