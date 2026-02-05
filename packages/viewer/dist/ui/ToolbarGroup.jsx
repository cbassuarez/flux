const escapeAttr = (value) => value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
export const toolbarGroup = ({ className, ariaLabel, role, children }) => {
    const classes = ["toolbar-group", className ?? ""].filter(Boolean).join(" ");
    const roleAttr = role ? ` role="${escapeAttr(role)}"` : "";
    const labelAttr = ariaLabel ? ` aria-label="${escapeAttr(ariaLabel)}"` : "";
    return `<div class="${classes}"${roleAttr}${labelAttr}>${children}</div>`;
};
//# sourceMappingURL=ToolbarGroup.jsx.map