import { promises as fs, statSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { chromium, type Browser } from "playwright";

export interface TypesetterPdfOptions {
  baseUrl?: string;
  timeoutMs?: number;
  preferCssPageSize?: boolean;
  allowFile?: boolean;
}

export interface TypesetterBackend {
  name: string;
  pdf(html: string, css: string, options?: TypesetterPdfOptions): Promise<Uint8Array>;
  paginate?: (html: string, css: string, options?: TypesetterPdfOptions) => Promise<string>;
}

export function createTypesetterBackend(): TypesetterBackend {
  const pro = detectProBackend();
  if (pro) return pro;
  return new PlaywrightBackend();
}

class PlaywrightBackend implements TypesetterBackend {
  name = "playwright";

  async pdf(html: string, css: string, options: TypesetterPdfOptions = {}): Promise<Uint8Array> {
    const doc = buildHtmlDocument(html, css, options.baseUrl);
    let browser: Browser | null = null;
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
      const pdf = await page.pdf({
        printBackground: true,
        preferCSSPageSize: options.preferCssPageSize ?? true,
      });
      return pdf;
    } finally {
      await browser?.close();
    }
  }
}

class ProBackend implements TypesetterBackend {
  name: string;
  private executable: string;

  constructor(name: string, executable: string) {
    this.name = name;
    this.executable = executable;
  }

  async pdf(html: string, css: string, options: TypesetterPdfOptions = {}): Promise<Uint8Array> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "flux-typesetter-"));
    const htmlPath = path.join(tmpDir, "index.html");
    const pdfPath = path.join(tmpDir, "output.pdf");
    const doc = buildHtmlDocument(html, css, options.baseUrl);
    await fs.writeFile(htmlPath, doc, "utf8");

    if (this.name === "prince") {
      await runCommand(this.executable, ["--media", "print", "-o", pdfPath, htmlPath]);
    } else {
      await runCommand(this.executable, ["-d", pdfPath, htmlPath]);
    }

    const buffer = await fs.readFile(pdfPath);
    await fs.rm(tmpDir, { recursive: true, force: true });
    return buffer;
  }
}

function detectProBackend(): TypesetterBackend | null {
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

function buildHtmlDocument(html: string, css: string, baseUrl?: string): string {
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

function which(cmd: string): string | null {
  const pathEntries = process.env.PATH?.split(path.delimiter) ?? [];
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const entry of pathEntries) {
    for (const ext of extensions) {
      const full = path.join(entry, `${cmd}${ext}`);
      try {
        if (fsSyncExists(full)) return full;
      } catch {
        continue;
      }
    }
  }
  return null;
}

function fsSyncExists(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function runCommand(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
