import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { Card } from "../components/Card.js";
import { color } from "../theme/index.js";
export function EditPlaceholderScreen({ width, docPath, debug, }) {
    return (_jsx(Card, { title: "Edit", meta: "", accent: true, ruleWidth: width - 6, debug: debug, children: _jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsx(Text, { color: color.fg, children: "Editor coming next." }), docPath ? (_jsxs(Text, { color: color.muted, children: ["Current document: ", docPath] })) : (_jsx(Text, { color: color.muted, children: "Select a document to get started." })), _jsx(Text, { color: color.muted, children: "Add section (disabled)" }), _jsx(Text, { color: color.muted, children: "Add figure (disabled)" })] }) }));
}
//# sourceMappingURL=EditPlaceholderScreen.js.map