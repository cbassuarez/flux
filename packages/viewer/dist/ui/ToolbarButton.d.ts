type ToolbarButtonOptions = {
    id?: string;
    label: string;
    icon?: string;
    title?: string;
    ariaLabel?: string;
    variant?: "ghost" | "primary" | "segmented";
    className?: string;
    iconOnly?: boolean;
    attributes?: Record<string, string>;
};
export declare const toolbarButton: ({ id, label, icon, title, ariaLabel, variant, className, iconOnly, attributes, }: ToolbarButtonOptions) => string;
export {};
//# sourceMappingURL=ToolbarButton.d.ts.map