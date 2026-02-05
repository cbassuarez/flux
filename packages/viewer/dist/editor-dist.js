import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const DEFAULT_INDEX = "index.html";
export async function resolveEditorDist(options = {}) {
    const env = options.env ?? process.env;
    const fsImpl = options.fsImpl ?? fs;
    const tried = [];
    const maybeCheck = async (rawPath, source) => {
        if (!rawPath)
            return null;
        const resolved = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
        tried.push(resolved);
        const ok = await hasIndex(fsImpl, resolved);
        if (ok) {
            return {
                dir: resolved,
                indexPath: path.join(resolved, DEFAULT_INDEX),
                source,
            };
        }
        return {
            dir: resolved,
            indexPath: null,
            source: "missing",
            reason: `Missing ${DEFAULT_INDEX} in ${resolved}`,
            tried,
        };
    };
    const flagResult = await maybeCheck(options.editorDist, "flag");
    if (flagResult)
        return flagResult;
    const envResult = await maybeCheck(env?.FLUX_EDITOR_DIST, "env");
    if (envResult)
        return envResult;
    const embedded = options.embeddedDir ?? defaultEmbeddedDir();
    tried.push(embedded);
    if (await hasIndex(fsImpl, embedded)) {
        return {
            dir: embedded,
            indexPath: path.join(embedded, DEFAULT_INDEX),
            source: "embedded",
        };
    }
    return {
        dir: embedded,
        indexPath: null,
        source: "missing",
        reason: `Missing ${DEFAULT_INDEX} in ${embedded}`,
        tried,
    };
}
export function defaultEmbeddedDir() {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(here, "..", "editor-dist");
}
async function hasIndex(fsImpl, dir) {
    try {
        const stats = await fsImpl.stat(dir);
        if (!stats.isDirectory())
            return false;
        await fsImpl.access(path.join(dir, DEFAULT_INDEX));
        return true;
    }
    catch {
        return false;
    }
}
export function buildEditorMissingHtml(resolution) {
    const tried = resolution.tried?.filter(Boolean) ?? [];
    const listItems = tried.map((item) => `<li><code>${escapeHtml(item)}</code></li>`).join("");
    const reason = resolution.reason ? `<p>${escapeHtml(resolution.reason)}</p>` : "";
    return [
        "<!doctype html>",
        "<html>",
        "<head>",
        '<meta charset="utf-8">',
        "<title>Flux Editor Missing</title>",
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        "<style>",
        "body { font-family: \"Source Sans 3\", system-ui, sans-serif; padding: 24px; background: #141311; color: #ece7df; }",
        "code { background: #1f1d19; padding: 2px 6px; border-radius: 4px; }",
        "a { color: #9fd0ff; }",
        "ul { padding-left: 20px; }",
        "</style>",
        "</head>",
        "<body>",
        "<h1>Flux editor bundle not found</h1>",
        reason,
        "<p>Build the editor in <code>../flux-site</code> (base <code>/edit/</code>), then sync its <code>dist/</code> directory:</p>",
        "<pre><code>npm --prefix ../flux-site run build:edit</code></pre>",
        "<pre><code>npm run sync-editor</code></pre>",
        "<p>Or point the viewer at a local editor build:</p>",
        "<pre><code>FLUX_EDITOR_DIST=/abs/path/to/flux-site/dist flux view &lt;file&gt;</code></pre>",
        "<p>CLI flag option:</p>",
        "<pre><code>flux view --editor-dist /abs/path/to/flux-site/dist &lt;file&gt;</code></pre>",
        "<p>Paths checked:</p>",
        `<ul>${listItems || "<li><em>none</em></li>"}</ul>`,
        "</body>",
        "</html>",
    ].join("\n");
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
//# sourceMappingURL=editor-dist.js.map