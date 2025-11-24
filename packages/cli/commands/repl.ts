// packages/cli/src/commands/repl.ts
import { parseDocument } from "@flux-lang/core";

export async function runRepl(): Promise<void> {
  // For v0.1, this is a single-shot "paste and parse" mode.
  // Later you can make it interactive line-by-line if you want.
  const src = await readAllStdin();

  if (!src.trim()) {
    console.error("flux repl: no input received on stdin.");
    return;
  }

  try {
    const doc = parseDocument(src);
    console.log("Parse succeeded.");
    const title = doc.meta?.title ?? "<unnamed>";
    const rules = doc.rules?.length ?? 0;
    const grids = doc.grids?.length ?? 0;
    console.log(`  title : ${JSON.stringify(title)}`);
    console.log(`  grids : ${grids}`);
    console.log(`  rules : ${rules}`);

    // Optional: pretty-print IR
    console.log("\nIR:");
    console.log(JSON.stringify(doc, null, 2));
  } catch (err) {
    console.error(`flux repl: parse error: ${(err as Error).message}`);
  }
}

async function readAllStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", (err) => reject(err));
  });
}

