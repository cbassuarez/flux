import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { Card } from "./Card.js";
import { color } from "../theme/index.js";
import { InputLine } from "./InputLine.js";
export function PromptModal({ label, value, width, debug, }) {
    return (_jsx(Box, { width: width, children: _jsxs(Card, { title: label, meta: "", accent: true, ruleWidth: width - 6, debug: debug, children: [_jsxs(Box, { flexDirection: "row", gap: 1, children: [_jsx(Text, { color: color.muted, children: "Value" }), _jsx(InputLine, { value: value, placeholder: "Type a value" })] }), _jsx(Text, { color: color.muted, children: "Enter to submit \u00B7 Esc to cancel" })] }) }));
}
//# sourceMappingURL=PromptModal.js.map