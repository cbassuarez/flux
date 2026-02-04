import path from "node:path";
import fs from "node:fs/promises";
import { parseDocument, type FluxDocument } from "@flux-lang/core";

export async function readSource(file: string): Promise<string> {
  if (file === "-") {
    return new Promise((resolve, reject) => {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => (data += chunk));
      process.stdin.on("end", () => resolve(data));
      process.stdin.on("error", (err) => reject(err));
    });
  }
  return fs.readFile(file, "utf8");
}

export function parseFlux(source: string, filePath: string | null): FluxDocument {
  if (!filePath || filePath === "-") {
    return parseDocument(source);
  }
  const resolved = path.resolve(filePath);
  return parseDocument(source, {
    sourcePath: resolved,
    docRoot: path.dirname(resolved),
    resolveIncludes: true,
  });
}

export function formatIoError(file: string, error: unknown): string {
  const msg = (error as Error)?.message ?? String(error);
  return `${file}:0:0: ${msg}`;
}

export function formatParseOrLexerError(file: string, error: unknown): string {
  const msg = (error as Error)?.message ?? String(error);
  return `${file}:0:0: ${msg}`;
}
