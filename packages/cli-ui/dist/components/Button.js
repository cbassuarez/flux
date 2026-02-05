import { jsx as _jsx } from "react/jsx-runtime";
import { Text } from "ink";
import { accent, color } from "../theme/index.js";
import { Clickable } from "./Clickable.js";
export function Button({ id, label, icon, onClick, active, }) {
    return (_jsx(Clickable, { id: id, onClick: onClick, priority: 1, children: _jsx(Text, { backgroundColor: active ? color.panelAlt : color.panel, color: active ? undefined : color.fg, children: active
                ? accent(` ${icon ? `${icon} ` : ""}${label} `)
                : ` ${icon ? `${icon} ` : ""}${label} ` }) }));
}
//# sourceMappingURL=Button.js.map