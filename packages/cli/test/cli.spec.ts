import { describe, it, expect } from "vitest";
import { execa } from "execa";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_ROOT = resolve(__dirname, "..");
const CLI_BIN = resolve(CLI_ROOT, "dist", "bin", "flux.js");

describe("flux CLI", () => {
    it("flux parse prints canonical JSON for a basic file", async () => {
        const fixture = resolve(CLI_ROOT, "test", "fixtures", "basic.flux");

        const { stdout, stderr, exitCode } = await execa(
            "node",
            [CLI_BIN, "parse", fixture],
            {
                reject: false,
                stripFinalNewline: false,
            },
        );

        expect(exitCode).toBe(0);
        expect(stderr).toBe("");

        // 1) Parse the JSON and assert the shape/content we care about.
        const doc = JSON.parse(stdout) as any;

        expect(doc.meta).toBeDefined();
        expect(doc.meta.title).toBe("CLI Basic");
        expect(doc.meta.version).toBe("0.1.0");

        expect(doc.state).toBeDefined();
        expect(Array.isArray(doc.state.params)).toBe(true);
        expect(doc.state.params[0].name).toBe("tempo");
        expect(doc.state.params[0].initial).toBe(60);

        // 2) Ensure the stdout is exactly the pretty-printed JSON form (+ newline).
        const pretty = JSON.stringify(doc, null, 2) + "\n";
        expect(stdout).toBe(pretty);
    });

it("flux check reports a missing grid reference and non-zero exit code", async () => {
    const fixture = resolve(
      CLI_ROOT,
      "test",
      "fixtures",
      "missing-grid.flux",
    );

    const { stdout, stderr, exitCode } = await execa(
        "node",
        [CLI_BIN, "check", fixture],
        {
            reject: false,
            stripFinalNewline: false,
        },
    );

    expect(exitCode).toBe(1);

    // Summary on stdout
    expect(stdout).toBe("✗ 1 of 1 files failed checks\n");

    // Diagnostic on stderr; path prefix may vary, but the tail should match.
    expect(
      stderr.trim().endsWith(
        "missing-grid.flux:0:0: Check error: Rule 'growNoise' references unknown grid 'main'",
      ),
    ).toBe(true);
  });

    it("flux render outputs Render IR with seed/time/docstep", async () => {
        const fixture = resolve(CLI_ROOT, "test", "fixtures", "doc-v0_2.flux");

        const { stdout, stderr, exitCode } = await execa(
            "node",
            [CLI_BIN, "render", "--format", "ir", "--seed", "5", "--time", "3", "--docstep", "2", fixture],
            {
                reject: false,
                stripFinalNewline: false,
            },
        );

        expect(exitCode).toBe(0);
        expect(stderr).toBe("");

        const rendered = JSON.parse(stdout) as any;
        expect(rendered.meta.title).toBe("Render Test");
        expect(rendered.seed).toBe(5);
        expect(rendered.time).toBe(3);
        expect(rendered.docstep).toBe(2);
        expect(rendered.body.length).toBeGreaterThan(0);
    });

    it("flux tick advances time and renders", async () => {
        const fixture = resolve(CLI_ROOT, "test", "fixtures", "doc-v0_2.flux");

        const { stdout, stderr, exitCode } = await execa(
            "node",
            [CLI_BIN, "tick", "--seconds", "5", fixture],
            {
                reject: false,
                stripFinalNewline: false,
            },
        );

        expect(exitCode).toBe(0);
        expect(stderr).toBe("");

        const rendered = JSON.parse(stdout) as any;
        expect(rendered.time).toBe(5);
    });

    it("flux step advances docsteps and renders", async () => {
        const fixture = resolve(CLI_ROOT, "test", "fixtures", "doc-v0_2.flux");

        const { stdout, stderr, exitCode } = await execa(
            "node",
            [CLI_BIN, "step", "--n", "3", fixture],
            {
                reject: false,
                stripFinalNewline: false,
            },
        );

        expect(exitCode).toBe(0);
        expect(stderr).toBe("");

        const rendered = JSON.parse(stdout) as any;
        expect(rendered.docstep).toBe(3);
    });
});
