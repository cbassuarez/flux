import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const fixtureSource = path.join(repoRoot, "packages/editor-ui/tests/fixtures/cli-edit-doc.flux");
const tmpDir = path.join(os.tmpdir(), "flux-cli-edit-e2e");
const tmpDocPath = path.join(tmpDir, "cli-edit-doc.flux");
const metaPath = path.join(repoRoot, "packages/editor-ui/tests/e2e/.cli-edit-path.json");

await fs.mkdir(tmpDir, { recursive: true });
const source = await fs.readFile(fixtureSource, "utf8");
await fs.writeFile(tmpDocPath, source, "utf8");
await fs.writeFile(metaPath, JSON.stringify({ docPath: tmpDocPath }), "utf8");

const cliPath = path.join(repoRoot, "packages/cli/dist/bin/flux.js");
const editorDist = path.join(repoRoot, "packages/editor-ui/dist");

const child = spawn(
  "node",
  [
    cliPath,
    "edit",
    tmpDocPath,
    "--port",
    "4173",
    "--quiet",
    "--no-time",
    "--editor-dist",
    editorDist,
  ],
  { stdio: "inherit" },
);

const shutdown = () => {
  child.kill("SIGTERM");
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
