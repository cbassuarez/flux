import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import path from "node:path";
import { ActionGrid } from "../components/ActionGrid.js";
import { Card } from "../components/Card.js";
import { Collapsible } from "../components/Collapsible.js";
import { StatusChips } from "../components/StatusChips.js";
import { color, truncateMiddle } from "../theme/index.js";
import { Button } from "../components/Button.js";
export function DashboardScreen({ width, activeDoc, backend, viewerStatus, streamOk, logs, logsOpen, onToggleLogs, actionItems, showEmptyState, onEmptyAction, debug, }) {
    const docName = activeDoc ? path.basename(activeDoc) : "No document selected";
    const docPath = activeDoc ? truncateMiddle(activeDoc, Math.max(20, width - 12)) : "Select a document to get started.";
    return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsxs(Card, { title: docName, meta: _jsx(Text, { color: streamOk ? "green" : color.muted, children: streamOk ? "● connected" : "○ idle" }), accent: true, ruleWidth: width - 6, debug: debug, children: [_jsx(Text, { color: color.muted, children: docPath }), _jsx(StatusChips, { backend: backend, live: streamOk, seed: viewerStatus?.seed, docstep: viewerStatus?.docstep, time: viewerStatus?.time })] }), _jsx(Card, { title: "Actions", meta: "", ruleWidth: width - 6, debug: debug, children: _jsx(ActionGrid, { items: actionItems }) }), showEmptyState ? (_jsxs(Card, { title: "Welcome", meta: "", ruleWidth: width - 6, debug: debug, children: [_jsx(Text, { color: color.fg, children: "Start a new Flux doc or open an existing one." }), _jsxs(Box, { flexDirection: "row", gap: 2, children: [_jsx(Button, { id: "empty-new", label: "New", onClick: () => onEmptyAction("new") }), _jsx(Button, { id: "empty-open", label: "Open", onClick: () => onEmptyAction("open") })] }), _jsx(Text, { color: color.muted, children: "Tip: Press Ctrl+K for the command palette." })] })) : null, logs.length > 0 ? (_jsx(Card, { title: "Diagnostics", meta: logsOpen ? "expanded" : "collapsed", ruleWidth: width - 6, debug: debug, children: _jsxs(Collapsible, { id: "diagnostics", title: `Errors (${logs.length})`, summary: logsOpen ? "Enter to collapse" : "Press Enter to expand", isOpen: logsOpen, onToggle: onToggleLogs, children: [logs.slice(0, 6).map((line, idx) => (_jsx(Text, { color: color.muted, children: line }, `${line}-${idx}`))), _jsx(Text, { color: color.muted, children: "Suggestion: run `flux check` for full output." })] }) })) : null] }));
}
//# sourceMappingURL=DashboardScreen.js.map