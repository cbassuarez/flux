import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from "ink";
import path from "node:path";
import { Card } from "../components/Card.js";
import { ActionGrid } from "../components/ActionGrid.js";
import { Button } from "../components/Button.js";
import { Collapsible } from "../components/Collapsible.js";
import { color, truncateMiddle } from "../theme/index.js";
export function EditScreen({ width, docPath, title, viewerUrl, onCopyUrl, onExport, onDoctor, onFormat, logs, logsOpen, onToggleLogs, debug, }) {
    const displayTitle = title ?? (docPath ? path.basename(docPath) : "No document selected");
    const editorUrl = viewerUrl ? `${viewerUrl}/edit` : null;
    return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsxs(Card, { title: "Edit", meta: "", accent: true, ruleWidth: width - 6, debug: debug, children: [docPath ? (_jsxs(Box, { flexDirection: "column", gap: 0, children: [_jsxs(Text, { color: color.muted, children: ["Document: ", displayTitle] }), _jsxs(Text, { color: color.muted, children: ["Path: ", truncateMiddle(docPath, Math.max(16, width - 10))] })] })) : (_jsx(Text, { color: color.muted, children: "Select a document to get started." })), viewerUrl ? (_jsxs(Box, { flexDirection: "column", gap: 0, marginTop: 1, children: [_jsxs(Text, { color: color.muted, children: ["Viewer URL: ", truncateMiddle(viewerUrl, Math.max(16, width - 10))] }), _jsxs(Text, { color: color.muted, children: ["Editor URL: ", truncateMiddle(editorUrl ?? "", Math.max(16, width - 10))] }), _jsx(Box, { marginTop: 1, children: _jsx(Button, { id: "edit-copy-url", label: "Copy URL", icon: "C", onClick: onCopyUrl }) })] })) : (_jsx(Text, { color: color.muted, children: "Start the editor to get a local URL." }))] }), _jsx(Card, { title: "Shortcuts", meta: "", ruleWidth: width - 6, debug: debug, children: _jsx(ActionGrid, { items: [
                        { id: "edit-export", label: "Export PDF", icon: "E", onClick: onExport },
                        { id: "edit-doctor", label: "Doctor", icon: "D", onClick: onDoctor },
                        { id: "edit-format", label: "Format", icon: "F", onClick: onFormat },
                    ] }) }), _jsx(Card, { title: "Logs", meta: logsOpen ? "expanded" : "collapsed", ruleWidth: width - 6, debug: debug, children: _jsx(Collapsible, { id: "edit-logs", title: "Session", summary: logsOpen ? "Enter to collapse" : "Press Enter or L to expand", isOpen: logsOpen, onToggle: onToggleLogs, children: logs.length ? (logs.map((line, idx) => (_jsx(Text, { color: color.muted, children: line }, `${line}-${idx}`)))) : (_jsx(Text, { color: color.muted, children: "No logs yet." })) }) })] }));
}
//# sourceMappingURL=EditScreen.js.map