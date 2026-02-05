import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { color } from "../theme/index.js";
export function InputLine({ value, placeholder }) {
    if (!value && placeholder) {
        return _jsx(Text, { color: color.muted, children: placeholder });
    }
    return (_jsxs(Box, { flexDirection: "row", children: [_jsx(Text, { children: value }), _jsx(Text, { color: color.muted, children: "\u258C" })] }));
}
//# sourceMappingURL=InputLine.js.map