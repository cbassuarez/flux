import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from "ink";
import path from "node:path";
import { Card } from "../components/Card.js";
import { Button } from "../components/Button.js";
import { Collapsible } from "../components/Collapsible.js";
import { TaskProgressView } from "../components/TaskProgressView.js";
import { color, truncateMiddle } from "../theme/index.js";
export function DoctorScreen({ width, docPath, summary, logs, logsOpen, progress, onToggleLogs, onRun, debug, }) {
    return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsxs(Card, { title: "Doctor", meta: "", accent: true, ruleWidth: width - 6, debug: debug, children: [docPath ? (_jsxs(Box, { flexDirection: "column", gap: 0, children: [_jsxs(Text, { color: color.muted, children: ["Document: ", path.basename(docPath)] }), _jsxs(Text, { color: color.muted, children: ["Path: ", truncateMiddle(docPath, Math.max(16, width - 10))] })] })) : (_jsx(Text, { color: color.muted, children: "No document selected." })), _jsx(Text, { color: color.fg, children: summary }), _jsx(Box, { marginTop: 1, children: _jsx(Button, { id: "doctor-run", label: "Run Doctor", icon: "\u2713", onClick: onRun }) })] }), progress ? (_jsx(Card, { title: "Task", meta: "", ruleWidth: width - 6, debug: debug, children: _jsx(TaskProgressView, { progress: progress }) })) : null, logs.length > 0 ? (_jsx(Card, { title: "Diagnostics", meta: logsOpen ? "expanded" : "collapsed", ruleWidth: width - 6, debug: debug, children: _jsx(Collapsible, { id: "doctor-logs", title: `Issues (${logs.length})`, summary: logsOpen ? "Enter to collapse" : "Press Enter or L to expand", isOpen: logsOpen, onToggle: onToggleLogs, children: logs.map((line, idx) => (_jsx(Text, { color: color.muted, children: line }, `${line}-${idx}`))) }) })) : null] }));
}
//# sourceMappingURL=DoctorScreen.js.map