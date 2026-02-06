import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { execa } from "execa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_ROOT = resolve(__dirname, "..");
const CLI_BIN = resolve(CLI_ROOT, "dist", "bin", "flux.js");

describe("flux --version", () => {
  it("prints cli, viewer, and editor versions", async () => {
    const { stdout, exitCode } = await execa("node", [CLI_BIN, "--version"], {
      reject: false,
      stripFinalNewline: false,
    });

    expect(exitCode).toBe(0);
    const lines = stdout.trim().split(/\r?\n/);
    expect(lines[0]).toMatch(/^cli /);
    expect(lines[1]).toMatch(/^viewer /);
    expect(lines[2]).toMatch(/^editor /);
  });
});
