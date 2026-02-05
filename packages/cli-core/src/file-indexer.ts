import fs from "node:fs/promises";
import path from "node:path";

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

export async function* walkFilesFromFs(options: WalkFilesOptions): AsyncGenerator<string> {
  const {
    root,
    maxDepth,
    readdir = (dir) => fs.readdir(dir, { withFileTypes: true, encoding: "utf8" }) as unknown as Promise<DirentLike[]>,
    signal,
    yieldEvery = 200,
    shouldEnterDir,
    includeFile,
  } = options;

  const queue: { dir: string; depth: number }[] = [{ dir: path.resolve(root), depth: maxDepth }];
  let seen = 0;

  while (queue.length > 0) {
    if (signal?.aborted) return;
    const next = queue.shift();
    if (!next) break;
    if (next.depth < 0) continue;

    let entries: DirentLike[];
    try {
      entries = await readdir(next.dir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (signal?.aborted) return;
      const full = path.join(next.dir, entry.name);
      if (entry.isDirectory()) {
        const allow = shouldEnterDir ? shouldEnterDir(full, entry) : true;
        if (allow) queue.push({ dir: full, depth: next.depth - 1 });
      } else if (entry.isFile()) {
        if (!includeFile || includeFile(full, entry)) {
          yield full;
        }
      }
      seen += 1;
      if (yieldEvery > 0 && seen % yieldEvery === 0) {
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    }
  }
}

export type FileIndexEvent =
  | { type: "file"; path: string }
  | { type: "done"; indexed: number; truncated: boolean };

export async function* indexFiles(options: {
  walker: AsyncIterable<string>;
  maxFiles: number;
  signal?: AbortSignal;
}): AsyncGenerator<FileIndexEvent> {
  const { walker, maxFiles, signal } = options;
  let indexed = 0;
  let truncated = false;

  for await (const file of walker) {
    if (signal?.aborted) break;
    if (indexed >= maxFiles) {
      truncated = true;
      break;
    }
    indexed += 1;
    yield { type: "file", path: file };
  }

  yield { type: "done", indexed, truncated };
}
