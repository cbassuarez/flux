import { jsx as _jsx } from "react/jsx-runtime";
import { Box } from "ink";
import { color } from "../theme/index.js";
export function PaneFrame({ focused, width, height, flexGrow, children, }) {
    return (_jsx(Box, { borderStyle: "round", borderColor: focused ? color.fg : color.border, paddingX: 1, paddingY: 0, width: width, height: height, flexGrow: flexGrow, flexDirection: "column", children: children }));
}
//# sourceMappingURL=PaneFrame.js.map