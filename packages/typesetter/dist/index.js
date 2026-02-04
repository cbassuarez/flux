import { promises as fs, statSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
export function createTypesetterBackend() {
    const pro = detectProBackend();
    if (pro)
        return pro;
    return new PlaywrightBackend();
}
class PlaywrightBackend {
    name = "playwright";
    async pdf(html, css, options = {}) {
        const doc = buildHtmlDocument(html, css, options.baseUrl);
        let browser = null;
        try {
            browser = await chromium.launch({
                headless: true,
                args: [
                    "--font-render-hinting=none",
                    "--disable-font-subpixel-positioning",
                    "--disable-breakpad",
                    "--disable-dev-shm-usage",
                    "--disable-extensions",
                ],
            });
            const page = await browser.newPage();
            await page.route("**/*", (route) => {
                const url = route.request().url();
                if (options.baseUrl && url.startsWith(options.baseUrl)) {
                    void route.continue();
                    return;
                }
                if (options.allowFile && url.startsWith("file://")) {
                    void route.continue();
                    return;
                }
                if (url.startsWith("data:")) {
                    void route.continue();
                    return;
                }
                void route.abort();
            });
            await page.setContent(doc, { waitUntil: "load", timeout: options.timeoutMs ?? 30000 });
            await page.emulateMedia({ media: "print" });
            await page.addStyleTag({
                content: `*{animation:none !important;transition:none !important;}`,
            });
            await applySlotFits(page);
            const pdf = await page.pdf({
                printBackground: true,
                preferCSSPageSize: options.preferCssPageSize ?? true,
            });
            return pdf;
        }
        finally {
            await browser?.close();
        }
    }
}
class ProBackend {
    name;
    executable;
    constructor(name, executable) {
        this.name = name;
        this.executable = executable;
    }
    async pdf(html, css, options = {}) {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "flux-typesetter-"));
        const htmlPath = path.join(tmpDir, "index.html");
        const pdfPath = path.join(tmpDir, "output.pdf");
        const doc = buildHtmlDocument(html, css, options.baseUrl);
        await fs.writeFile(htmlPath, doc, "utf8");
        if (this.name === "prince") {
            await runCommand(this.executable, ["--media", "print", "-o", pdfPath, htmlPath]);
        }
        else {
            await runCommand(this.executable, ["-d", pdfPath, htmlPath]);
        }
        const buffer = await fs.readFile(pdfPath);
        await fs.rm(tmpDir, { recursive: true, force: true });
        return buffer;
    }
}
function detectProBackend() {
    const prince = which("prince");
    if (prince) {
        return new ProBackend("prince", prince);
    }
    const ah = which("ah");
    if (ah) {
        return new ProBackend("antenna-house", ah);
    }
    return null;
}
function buildHtmlDocument(html, css, baseUrl) {
    const safeBase = baseUrl ? `<base href="${escapeHtml(baseUrl)}">` : "";
    return [
        "<!doctype html>",
        "<html>",
        "<head>",
        '<meta charset="utf-8">',
        safeBase,
        "<style>",
        css,
        "</style>",
        "</head>",
        "<body>",
        html,
        "</body>",
        "</html>",
    ].join("");
}
async function applySlotFits(page) {
    await page.evaluate(() => {
        const fitsWithin = (container, inner) => {
            return inner.scrollWidth <= container.clientWidth && inner.scrollHeight <= container.clientHeight;
        };
        const applyFit = (slot) => {
            const fit = slot.getAttribute("data-flux-fit");
            const inner = slot.querySelector("[data-flux-slot-inner]") || slot.querySelector(".flux-slot-inner");
            if (!inner || !(inner instanceof HTMLElement) || !(slot instanceof HTMLElement))
                return;
            const isInline = slot.getAttribute("data-flux-inline") === "true";
            inner.style.transform = "";
            inner.style.fontSize = "";
            inner.style.whiteSpace = "";
            inner.style.textOverflow = "";
            inner.style.webkitLineClamp = "";
            inner.style.webkitBoxOrient = "";
            inner.style.display = "";
            if (fit === "shrink") {
                const style = window.getComputedStyle(inner);
                const base = parseFloat(style.fontSize) || 14;
                let lo = 6;
                let hi = base;
                let best = base;
                for (let i = 0; i < 10; i += 1) {
                    const mid = (lo + hi) / 2;
                    inner.style.fontSize = `${mid}px`;
                    if (fitsWithin(slot, inner)) {
                        best = mid;
                        lo = mid + 0.1;
                    }
                    else {
                        hi = mid - 0.1;
                    }
                }
                inner.style.fontSize = `${best}px`;
            }
            else if (fit === "scaleDown") {
                inner.style.transformOrigin = "top left";
                const scaleX = slot.clientWidth / inner.scrollWidth;
                const scaleY = slot.clientHeight / inner.scrollHeight;
                const scale = Math.min(1, scaleX, scaleY);
                inner.style.transform = `scale(${scale})`;
            }
            else if (fit === "ellipsis") {
                if (isInline) {
                    inner.style.display = "inline-block";
                    inner.style.whiteSpace = "nowrap";
                    inner.style.textOverflow = "ellipsis";
                    inner.style.overflow = "hidden";
                }
                else {
                    const lineHeight = parseFloat(window.getComputedStyle(inner).lineHeight) || 16;
                    const maxLines = Math.max(1, Math.floor(slot.clientHeight / lineHeight));
                    inner.style.display = "-webkit-box";
                    inner.style.webkitBoxOrient = "vertical";
                    inner.style.webkitLineClamp = String(maxLines);
                    inner.style.overflow = "hidden";
                }
            }
        };
        document.querySelectorAll("[data-flux-fit]").forEach((slot) => applyFit(slot));
    });
}
function which(cmd) {
    const pathEntries = process.env.PATH?.split(path.delimiter) ?? [];
    const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
    for (const entry of pathEntries) {
        for (const ext of extensions) {
            const full = path.join(entry, `${cmd}${ext}`);
            try {
                if (fsSyncExists(full))
                    return full;
            }
            catch {
                continue;
            }
        }
    }
    return null;
}
function fsSyncExists(filePath) {
    try {
        return statSync(filePath).isFile();
    }
    catch {
        return false;
    }
}
function runCommand(cmd, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: "inherit" });
        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0)
                resolve();
            else
                reject(new Error(`${cmd} exited with code ${code}`));
        });
    });
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
//# sourceMappingURL=index.js.map