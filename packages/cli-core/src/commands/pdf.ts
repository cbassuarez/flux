import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { renderDocumentIR, type RenderAsset, type RenderDocumentIR } from "@flux-lang/core";
import type { FluxDocument } from "@flux-lang/core";
import { errorResult, okResult, type CommandResult } from "../types.js";
import { formatIoError, formatParseOrLexerError, parseFlux, readSource } from "./common.js";

export interface PdfOptions {
  file: string;
  outPath: string;
  seed?: number;
  docstep?: number;
}

export interface PdfData {
  outPath: string;
  bytes: number;
}

const PLACEHOLDER_IMG =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

export async function pdfCommand(options: PdfOptions): Promise<CommandResult<PdfData>> {
  if (!options.file) {
    return errorResult("flux pdf: No input file specified.", "NO_INPUT");
  }
  if (!options.outPath) {
    return errorResult("flux pdf: --out <file.pdf> is required.", "NO_OUTPUT");
  }

  let source: string;
  try {
    source = await readSource(options.file);
  } catch (error) {
    return errorResult(formatIoError(options.file, error), "READ_ERROR", error);
  }

  let doc: FluxDocument;
  try {
    doc = parseFlux(source, options.file);
  } catch (error) {
    return errorResult(formatParseOrLexerError(options.file, error), "PARSE_ERROR", error);
  }

  const dir = options.file === "-" ? process.cwd() : path.dirname(path.resolve(options.file));
  const ir: RenderDocumentIR = renderDocumentIR(doc, { seed: options.seed, docstep: options.docstep, assetCwd: dir });

  const assetUrl = (assetId: string): string => {
    const asset = ir.assets.find((entry: RenderAsset) => entry.id === assetId);
    if (!asset?.path) return PLACEHOLDER_IMG;
    const resolved = path.isAbsolute(asset.path) ? asset.path : path.resolve(dir, asset.path);
    return pathToFileURL(resolved).toString();
  };

  const rawUrl = (raw: string): string => {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return PLACEHOLDER_IMG;
    }
    const resolved = path.isAbsolute(raw) ? raw : path.resolve(dir, raw);
    return pathToFileURL(resolved).toString();
  };

  const { renderHtml } = await import("@flux-lang/render-html");
  const { createTypesetterBackend } = await import("@flux-lang/typesetter");
  const { html, css } = renderHtml(ir, { assetUrl, rawUrl });
  const typesetter = createTypesetterBackend();
  const pdf = await typesetter.pdf(html, css, { allowFile: true });
  await fs.writeFile(options.outPath, pdf);
  return okResult({ outPath: options.outPath, bytes: pdf.byteLength });
}
