import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import path from "node:path";
import { Card } from "../components/Card.js";
import { ActionGrid } from "../components/ActionGrid.js";
import { Button } from "../components/Button.js";
import { color, truncateMiddle } from "../theme/index.js";
export function DocDetailsScreen({ width, docPath, preview, primaryActions, secondaryActions, debug, }) {
    const title = preview?.title ?? (docPath ? path.basename(docPath) : "No document selected");
    const filePath = docPath ?? "";
    return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsx(Card, { title: title, meta: "", accent: true, ruleWidth: width - 6, debug: debug, children: filePath ? (_jsxs(Box, { flexDirection: "column", gap: 0, children: [_jsx(Text, { color: color.muted, children: truncateMiddle(filePath, Math.max(16, width - 8)) }), preview?.modified ? _jsxs(Text, { color: color.muted, children: ["Modified: ", preview.modified] }) : null, preview?.size ? _jsxs(Text, { color: color.muted, children: ["Size: ", preview.size] }) : null] })) : (_jsx(Text, { color: color.muted, children: "Select a document to get started." })) }), _jsx(Card, { title: "Primary actions", meta: "", ruleWidth: width - 6, debug: debug, children: _jsx(ActionGrid, { items: primaryActions }) }), _jsx(Card, { title: "Secondary actions", meta: "", ruleWidth: width - 6, debug: debug, children: _jsx(Box, { flexDirection: "row", gap: 2, children: secondaryActions.map((action) => (_jsx(Button, { ...action }, action.id))) }) })] }));
}
//# sourceMappingURL=DocDetailsScreen.js.map