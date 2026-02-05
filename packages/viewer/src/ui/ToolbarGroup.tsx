type ToolbarGroupOptions = {
  className?: string;
  ariaLabel?: string;
  role?: string;
  children: string;
};

const escapeAttr = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const toolbarGroup = ({ className, ariaLabel, role, children }: ToolbarGroupOptions): string => {
  const classes = ["toolbar-group", className ?? ""].filter(Boolean).join(" ");
  const roleAttr = role ? ` role="${escapeAttr(role)}"` : "";
  const labelAttr = ariaLabel ? ` aria-label="${escapeAttr(ariaLabel)}"` : "";
  return `<div class="${classes}"${roleAttr}${labelAttr}>${children}</div>`;
};
