export interface PinnedDirsStore {
    entries: string[];
    storePath: string;
    repoRoot: string | null;
    fallback: boolean;
}
export declare function getPinnedDirsStore(cwd: string): Promise<PinnedDirsStore>;
export declare function addPinnedDir(cwd: string, dir: string, maxEntries?: number): Promise<PinnedDirsStore>;
export declare function removePinnedDir(cwd: string, dir: string): Promise<PinnedDirsStore>;
export declare function togglePinnedDir(cwd: string, dir: string, maxEntries?: number): Promise<PinnedDirsStore>;
export declare function isPinnedDir(store: PinnedDirsStore, dir: string): boolean;
//# sourceMappingURL=pinned.d.ts.map