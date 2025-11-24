// packages/cli/src/fs-utils.ts
import fs from "node:fs";
import path from "node:path";

export function readFileText(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

export function writeFileText(filePath: string, text: string): void {
  fs.writeFileSync(filePath, text, "utf8");
}

export function collectFluxFiles(
  root: string,
  recursive = true,
): string[] {
  const result: string[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (recursive) walk(full);
      } else if (entry.isFile() && full.endsWith(".flux")) {
        result.push(full);
      }
    }
  }

  const stat = fs.statSync(root);
  if (stat.isDirectory()) {
    walk(root);
  } else if (stat.isFile() && root.endsWith(".flux")) {
    result.push(root);
  }

  return result;
}

