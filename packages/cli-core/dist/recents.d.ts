export interface RecentEntry {
    path: string;
    lastOpened: string;
}
export interface RecentsStore {
    entries: RecentEntry[];
    storePath: string;
    repoRoot: string | null;
    fallback: boolean;
}
export declare function getRecentsStore(cwd: string): Promise<RecentsStore>;
export declare function updateRecents(cwd: string, docPath: string): Promise<RecentsStore>;
//# sourceMappingURL=recents.d.ts.map