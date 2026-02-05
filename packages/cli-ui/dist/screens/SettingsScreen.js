import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { Card } from "../components/Card.js";
import { Clickable } from "../components/Clickable.js";
import { color } from "../theme/index.js";
export function SettingsScreen({ width, config, debugLayout, onToggleDebug, debug, }) {
    if (!config) {
        return (_jsx(Card, { title: "Settings", meta: "", accent: true, ruleWidth: width - 6, debug: debug, children: _jsx(Text, { color: color.muted, children: "Loading config\u2026" }) }));
    }
    return (_jsx(Card, { title: "Settings", meta: "", accent: true, ruleWidth: width - 6, debug: debug, children: _jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsxs(Text, { color: color.muted, children: ["docstepMs: ", config.docstepMs] }), _jsxs(Text, { color: color.muted, children: ["advanceTime: ", config.advanceTime ? "yes" : "no"] }), _jsxs(Text, { color: color.muted, children: ["defaultPage: ", config.defaultPageSize] }), _jsxs(Text, { color: color.muted, children: ["defaultTheme: ", config.defaultTheme] }), _jsxs(Text, { color: color.muted, children: ["defaultFonts: ", config.defaultFonts] }), _jsx(Clickable, { id: "toggle-debug", onClick: onToggleDebug, priority: 1, children: _jsxs(Text, { color: debugLayout ? color.fg : color.muted, children: ["Debug layout: ", debugLayout ? "on" : "off"] }) }), _jsx(Text, { color: color.muted, children: "Press I to initialize config \u00B7 D to set docstepMs \u00B7 T to toggle debug" })] }) }));
}
//# sourceMappingURL=SettingsScreen.js.map