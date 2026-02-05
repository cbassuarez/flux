type PreviewInfo = {
    title?: string | null;
    filePath: string;
    modified?: string;
    size?: string;
    status?: string | null;
};
type ListItem = {
    id: string;
    label: string;
    meta?: string;
    path: string;
};
export declare function OpenScreen({ width, query, showAll, rootDir, results, selectedIndex, folders, folderIndex, activeList, pinnedDirs, recentDirs, isPinned, indexing, truncated, preview, onToggleShowAll, onOpenSelected, onSelectResult, onSelectFolder, onSelectPinned, onSelectRecent, onTogglePin, debug, }: {
    width: number;
    query: string;
    showAll: boolean;
    rootDir: string;
    results: ListItem[];
    selectedIndex: number;
    folders: string[];
    folderIndex: number;
    activeList: "results" | "folders";
    pinnedDirs: string[];
    recentDirs: string[];
    isPinned: boolean;
    indexing: boolean;
    truncated: boolean;
    preview: PreviewInfo | null;
    onToggleShowAll: () => void;
    onOpenSelected: () => void;
    onSelectResult: (index: number) => void;
    onSelectFolder: (index: number) => void;
    onSelectPinned: (dir: string) => void;
    onSelectRecent: (dir: string) => void;
    onTogglePin: () => void;
    debug?: boolean;
}): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=OpenScreen.d.ts.map