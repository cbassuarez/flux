import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { color } from "../theme/index.js";
export function InputLine({ value, placeholder, focused = false, }) {
    const showPlaceholder = !value && placeholder;
    const displayValue = showPlaceholder ? placeholder ?? "" : value;
    const displayColor = showPlaceholder ? color.muted : undefined;
    return (_jsxs(Box, { flexDirection: "row", children: [displayValue.length > 0 ? _jsx(Text, { color: displayColor, children: displayValue }) : null, focused ? _jsx(Text, { color: color.muted, children: "\u258C" }) : null] }));
}
//# sourceMappingURL=InputLine.js.map