const escapeAttr = (value) => value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
const attrsToString = (attrs) => {
    if (!attrs)
        return "";
    return Object.entries(attrs)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => ` ${key}="${escapeAttr(String(value))}"`)
        .join("");
};
export const toolbarButton = ({ id, label, icon, title, ariaLabel, variant = "ghost", className, iconOnly = false, attributes, }) => {
    const classes = [
        "toolbar-btn",
        variant === "primary" ? "toolbar-btn--primary" : "",
        variant === "segmented" ? "toolbar-btn--segmented" : "",
        iconOnly ? "toolbar-btn--icon" : "",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");
    const labelMarkup = iconOnly
        ? `<span class="sr-only">${label}</span>`
        : `<span class="toolbar-btn__label">${label}</span>`;
    const iconMarkup = icon ? `<span class="toolbar-icon" aria-hidden="true">${icon}</span>` : "";
    const baseAttrs = {
        ...(id ? { id } : {}),
        ...(title ? { title } : {}),
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
    };
    const mergedAttrs = { ...baseAttrs, ...attributes };
    return `<button class="${classes}" type="button"${attrsToString(mergedAttrs)}>${iconMarkup}${labelMarkup}</button>`;
};
//# sourceMappingURL=ToolbarButton.jsx.map