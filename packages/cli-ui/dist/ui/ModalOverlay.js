import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { Box, Text, useInput } from "ink";
import { color, mutedRuleText } from "../theme/index.js";
import { useTerminalDimensions } from "./useTerminalDimensions.js";
export const MODAL_MARGIN = 2;
export const MODAL_MIN_WIDTH = 52;
export const MODAL_MAX_WIDTH = 96;
export const MODAL_MIN_HEIGHT = 12;
export const MODAL_MAX_HEIGHT = 24;
export const MODAL_PADDING_X = 2;
export const MODAL_PADDING_Y = 1;
export const MODAL_BORDER_WIDTH = 1;
export function buildFillLines(width, height) {
    const safeWidth = Math.max(0, width);
    const safeHeight = Math.max(0, height);
    const line = " ".repeat(safeWidth);
    return Array.from({ length: safeHeight }, () => line).join("\n");
}
export function getModalLayout({ columns, rows, width, height }) {
    const safeColumns = Math.max(0, columns);
    const safeRows = Math.max(0, rows);
    const maxWidth = Math.max(1, safeColumns - MODAL_MARGIN * 2);
    const maxHeight = Math.max(1, safeRows - MODAL_MARGIN * 2);
    const minWidth = Math.min(MODAL_MIN_WIDTH, maxWidth);
    const minHeight = Math.min(MODAL_MIN_HEIGHT, maxHeight);
    const defaultWidth = Math.min(MODAL_MAX_WIDTH, maxWidth);
    const defaultHeight = Math.min(MODAL_MAX_HEIGHT, maxHeight);
    const rawWidth = typeof width === "number" ? width : defaultWidth;
    const rawHeight = typeof height === "number" ? height : defaultHeight;
    const panelWidth = Math.max(minWidth, Math.min(rawWidth, maxWidth));
    const panelHeight = Math.max(minHeight, Math.min(rawHeight, maxHeight));
    const left = Math.max(0, Math.floor((safeColumns - panelWidth) / 2));
    const top = Math.max(0, Math.floor((safeRows - panelHeight) / 2));
    const contentWidth = Math.max(0, panelWidth - MODAL_PADDING_X * 2 - MODAL_BORDER_WIDTH * 2);
    const contentHeight = Math.max(0, panelHeight - MODAL_PADDING_Y * 2 - MODAL_BORDER_WIDTH * 2);
    return {
        width: panelWidth,
        height: panelHeight,
        left,
        top,
        contentWidth,
        contentHeight,
    };
}
export function ModalOverlay({ isOpen, title, subtitle, width, height, onRequestClose, children, footer, }) {
    const { columns, rows } = useTerminalDimensions();
    const layout = useMemo(() => getModalLayout({ columns, rows, width, height }), [columns, rows, width, height]);
    const scrimFill = useMemo(() => buildFillLines(columns, rows), [columns, rows]);
    const panelFill = useMemo(() => buildFillLines(layout.width, layout.height), [layout.width, layout.height]);
    useInput((_, key) => {
        if (key.escape) {
            onRequestClose();
        }
    }, { isActive: isOpen });
    if (!isOpen)
        return null;
    return (_jsxs(Box, { position: "absolute", width: columns, height: rows, children: [_jsx(Box, { position: "absolute", width: columns, height: rows, children: _jsx(Text, { backgroundColor: color.panel, color: color.panel, children: scrimFill }) }), _jsx(Box, { position: "absolute", marginTop: layout.top, marginLeft: layout.left, width: layout.width, height: layout.height, children: _jsxs(Box, { position: "relative", width: layout.width, height: layout.height, children: [_jsx(Box, { position: "absolute", width: layout.width, height: layout.height, children: _jsx(Text, { backgroundColor: color.panelAlt, color: color.panelAlt, children: panelFill }) }), _jsx(Box, { flexDirection: "column", paddingX: MODAL_PADDING_X, paddingY: MODAL_PADDING_Y, width: layout.width, height: layout.height, borderStyle: "single", borderColor: color.border, children: _jsxs(Box, { flexDirection: "column", gap: 1, width: "100%", height: "100%", children: [_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: color.fg, bold: true, children: title }), subtitle ? _jsx(Text, { color: color.muted, children: subtitle }) : null, layout.contentWidth > 0 ? _jsx(Text, { children: mutedRuleText(layout.contentWidth) }) : null] }), _jsx(Box, { flexDirection: "column", flexGrow: 1, children: children }), footer ? (_jsx(Box, { children: footer })) : null] }) })] }) })] }));
}
//# sourceMappingURL=ModalOverlay.js.map