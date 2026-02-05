export type DirentLike = {
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
};
export type WalkFilesOptions = {
    root: string;
    maxDepth: number;
    readdir?: (dir: string) => Promise<DirentLike[]>;
    signal?: AbortSignal;
    yieldEvery?: number;
    shouldEnterDir?: (dirPath: string, dirent: DirentLike) => boolean;
    includeFile?: (filePath: string, dirent: DirentLike) => boolean;
};
export declare function walkFilesFromFs(options: WalkFilesOptions): AsyncGenerator<string>;
export type FileIndexEvent = {
    type: "file";
    path: string;
} | {
    type: "done";
    indexed: number;
    truncated: boolean;
};
export declare function indexFiles(options: {
    walker: AsyncIterable<string>;
    maxFiles: number;
    signal?: AbortSignal;
}): AsyncGenerator<FileIndexEvent>;
//# sourceMappingURL=file-indexer.d.ts.map