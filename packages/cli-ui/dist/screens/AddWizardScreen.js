import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { Card } from "../components/Card.js";
import { color } from "../theme/index.js";
export function AddWizardScreen({ width, debug }) {
    return (_jsx(Card, { title: "Add to document", meta: "", accent: true, ruleWidth: width - 6, debug: debug, children: _jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsx(Text, { color: color.muted, children: "Add a section, figure, or other building block." }), _jsx(Text, { color: color.muted, children: "Use / to open the command palette." })] }) }));
}
//# sourceMappingURL=AddWizardScreen.js.map