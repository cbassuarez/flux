import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box } from "ink";
import { Button } from "./Button.js";
export function ActionGrid({ items }) {
    const left = items.filter((_, idx) => idx % 2 === 0);
    const right = items.filter((_, idx) => idx % 2 === 1);
    return (_jsxs(Box, { flexDirection: "row", gap: 2, children: [_jsx(Box, { flexDirection: "column", gap: 1, children: left.map((item) => (_jsx(Button, { ...item }, item.id))) }), _jsx(Box, { flexDirection: "column", gap: 1, children: right.map((item) => (_jsx(Button, { ...item }, item.id))) })] }));
}
//# sourceMappingURL=ActionGrid.js.map