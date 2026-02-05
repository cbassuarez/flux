import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { accentRule, color, mutedRuleText } from "../theme/index.js";
export function Card({ title, meta, accent, children, footer, width, ruleWidth, debug, }) {
    const computedRule = accent
        ? accentRule(ruleWidth ?? 24)
        : mutedRuleText(ruleWidth ?? 24);
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, paddingY: 0, width: width, borderStyle: debug ? "classic" : undefined, borderColor: debug ? "magenta" : undefined, children: [_jsxs(Box, { flexDirection: "row", justifyContent: "space-between", paddingTop: 1, children: [_jsx(Text, { color: color.fg, bold: true, children: title }), meta
                        ? typeof meta === "string"
                            ? _jsx(Text, { color: color.muted, children: meta })
                            : meta
                        : null] }), _jsx(Text, { children: computedRule }), _jsx(Box, { flexDirection: "column", paddingY: 1, gap: 1, children: children }), footer ? (_jsx(Box, { paddingBottom: 1, children: footer })) : null] }));
}
//# sourceMappingURL=Card.js.map