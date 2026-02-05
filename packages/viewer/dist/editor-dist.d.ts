import { promises as fs } from "node:fs";
export type EditorDistSource = "flag" | "env" | "embedded" | "missing";
export interface EditorDistResolution {
    dir: string | null;
    indexPath: string | null;
    source: EditorDistSource;
    reason?: string;
    tried?: string[];
}
export interface ResolveEditorDistOptions {
    editorDist?: string;
    env?: NodeJS.ProcessEnv;
    embeddedDir?: string;
    fsImpl?: Pick<typeof fs, "stat" | "access">;
}
export declare function resolveEditorDist(options?: ResolveEditorDistOptions): Promise<EditorDistResolution>;
export declare function defaultEmbeddedDir(): string;
export declare function buildEditorMissingHtml(resolution: EditorDistResolution): string;
//# sourceMappingURL=editor-dist.d.ts.map