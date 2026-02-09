import path from "node:path";
import { errorResult, okResult } from "../types.js";
import { ensureDir, pathExists, writeFileText } from "../fs.js";
import { getTemplate, stripTrailingCommasInLists } from "../new/templates.js";
export async function newCommand(options) {
    const template = getTemplate(options.template);
    if (!template) {
        return errorResult(`flux new: unknown template '${options.template}'`, "UNKNOWN_TEMPLATE");
    }
    const normalized = normalizeNewOptions(options);
    const output = resolveOutputPath(normalized);
    if (await pathExists(output.docPath)) {
        return errorResult(`flux new: ${output.docPath} already exists`, "EXISTS");
    }
    await ensureDir(output.dir);
    const built = template.build({
        title: normalized.title,
        page: normalized.page,
        theme: normalized.theme,
        fonts: normalized.fonts,
        fontFallback: normalized.fontFallback,
        assets: normalized.assets,
        chapters: normalized.chapters,
        live: normalized.live,
    });
    const files = [];
    const sanitizedMainFlux = stripTrailingCommasInLists(built.mainFlux);
    await writeFileText(output.docPath, sanitizedMainFlux);
    files.push(output.docPath);
    const readmePath = path.join(output.dir, "README.md");
    await writeFileText(readmePath, built.readme);
    files.push(readmePath);
    if (built.assetsDir) {
        const assetsPath = path.join(output.dir, built.assetsDir);
        await ensureDir(assetsPath);
        files.push(assetsPath);
    }
    if (built.chapters.length) {
        const chaptersDir = path.join(output.dir, "chapters");
        await ensureDir(chaptersDir);
        files.push(chaptersDir);
        for (const chapter of built.chapters) {
            const chapterPath = path.join(chaptersDir, chapter.path);
            const sanitizedChapter = stripTrailingCommasInLists(chapter.content);
            await writeFileText(chapterPath, sanitizedChapter);
            files.push(chapterPath);
        }
    }
    return okResult({ dir: output.dir, docPath: output.docPath, files });
}
function normalizeNewOptions(options) {
    const title = options.title ?? titleFromTemplate(options.template);
    const defaults = {
        page: options.page ?? "Letter",
        theme: options.theme ?? "screen",
        fonts: options.fonts ?? "tech",
        fontFallback: options.fontFallback ?? "system",
        assets: options.assets ?? true,
        chapters: options.chapters ?? 0,
        live: options.live ?? (options.template === "demo"),
        title,
        slug: options.slug ? slugify(options.slug) : slugify(title),
    };
    return { ...options, ...defaults };
}
function titleFromTemplate(template) {
    const map = {
        demo: "Flux Demo",
        article: "Flux Article",
        spec: "Flux Spec",
        zine: "Flux Zine",
        paper: "Flux Paper",
        blank: "Flux Document",
    };
    return map[template] ?? "Flux Document";
}
function resolveOutputPath(options) {
    const out = options.out ? path.resolve(options.cwd, options.out) : path.resolve(options.cwd);
    if (out.endsWith(".flux")) {
        return { dir: path.dirname(out), docPath: out };
    }
    const slug = options.slug ?? slugify(options.title);
    const dir = out;
    const docPath = path.join(dir, `${slug}.flux`);
    return { dir, docPath };
}
function slugify(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "flux-document";
}
//# sourceMappingURL=new.js.map