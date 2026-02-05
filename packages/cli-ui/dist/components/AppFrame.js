import { jsx as _jsx } from "react/jsx-runtime";
import { Box } from "ink";
import { color } from "../theme/index.js";
export function AppFrame({ children, debug }) {
    return (_jsx(Box, { borderStyle: "single", borderColor: debug ? "yellow" : color.border, padding: 1, flexDirection: "column", height: "100%", width: "100%", position: "relative", children: children }));
}
//# sourceMappingURL=AppFrame.js.map