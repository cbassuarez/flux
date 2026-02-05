export interface LastUsedDirStore {
    dir: string | null;
    storePath: string;
    repoRoot: string | null;
    fallback: boolean;
}
export declare function getLastUsedDirStore(cwd: string): Promise<LastUsedDirStore>;
export declare function setLastUsedDir(cwd: string, dir: string): Promise<LastUsedDirStore>;
//# sourceMappingURL=last-used-dir.d.ts.map