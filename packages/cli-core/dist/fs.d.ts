export declare function readFileText(filePath: string): Promise<string>;
export declare function writeFileText(filePath: string, text: string): Promise<void>;
export declare function readJsonFile<T>(filePath: string): Promise<T | null>;
export declare function writeJsonFile<T>(filePath: string, value: T): Promise<void>;
export declare function pathExists(filePath: string): Promise<boolean>;
export declare function findGitRoot(startDir: string): Promise<string | null>;
export declare function ensureDir(dir: string): Promise<void>;
export declare function repoStatePath(repoRoot: string): string;
export declare function fallbackStatePath(cwd: string): string;
//# sourceMappingURL=fs.d.ts.map