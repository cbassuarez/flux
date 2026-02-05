import { jsx as _jsx } from "react/jsx-runtime";
import { Box } from "ink";
import { useMouseRegion } from "../state/mouse.js";
export function Clickable({ id, onClick, children, priority, }) {
    const ref = useMouseRegion(id, onClick, priority ?? 0);
    return (_jsx(Box, { ref: ref, flexDirection: "column", children: children }));
}
//# sourceMappingURL=Clickable.js.map