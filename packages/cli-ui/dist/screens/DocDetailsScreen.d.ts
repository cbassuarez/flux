export type DocDetailsPreview = {
    title?: string | null;
    filePath: string;
    modified?: string;
    size?: string;
};
export declare function DocDetailsScreen({ width, docPath, preview, primaryActions, secondaryActions, debug, }: {
    width: number;
    docPath: string | null;
    preview: DocDetailsPreview | null;
    primaryActions: {
        id: string;
        label: string;
        icon?: string;
        onClick: () => void;
        active?: boolean;
    }[];
    secondaryActions: {
        id: string;
        label: string;
        icon?: string;
        onClick: () => void;
        active?: boolean;
    }[];
    debug?: boolean;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=DocDetailsScreen.d.ts.map