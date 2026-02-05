export type ActionItem = {
    id: string;
    label: string;
    icon?: string;
    onClick: () => void;
    active?: boolean;
};
export declare function ActionGrid({ items }: {
    items: ActionItem[];
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=ActionGrid.d.ts.map