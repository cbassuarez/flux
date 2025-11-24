// packages/cli/src/fs-utils.ts
import fs from "node:fs";
import path from "node:path";
export function readFileText(filePath) {
    return fs.readFileSync(filePath, "utf8");
}
export function writeFileText(filePath, text) {
    fs.writeFileSync(filePath, text, "utf8");
}
export function collectFluxFiles(root, recursive = true) {
    const result = [];
    function walk(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (recursive)
                    walk(full);
            }
            else if (entry.isFile() && full.endsWith(".flux")) {
                result.push(full);
            }
        }
    }
    const stat = fs.statSync(root);
    if (stat.isDirectory()) {
        walk(root);
    }
    else if (stat.isFile() && root.endsWith(".flux")) {
        result.push(root);
    }
    return result;
}
