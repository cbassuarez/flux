import path from "node:path";
import fs from "node:fs/promises";
import { parseDocument } from "@flux-lang/core";
export async function readSource(file) {
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
export function parseFlux(source, filePath) {
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
export function formatIoError(file, error) {
    const msg = error?.message ?? String(error);
    return `${file}:0:0: ${msg}`;
}
export function formatParseOrLexerError(file, error) {
    const msg = error?.message ?? String(error);
    return `${file}:0:0: ${msg}`;
}
//# sourceMappingURL=common.js.map