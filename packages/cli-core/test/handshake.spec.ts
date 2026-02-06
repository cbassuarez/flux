import { describe, expect, it } from "vitest";
import { validateHandshake } from "../src/viewer/manager.js";

describe("handshake validation", () => {
  it("passes when versions match", () => {
    const mismatch = validateHandshake(
      { viewerVersion: "1.2.3", editorBuildId: "editor-aaa" },
      { viewerVersion: "1.2.3", editorBuildId: "editor-aaa" },
    );
    expect(mismatch).toBeNull();
  });

  it("fails with clear message when viewer mismatches", () => {
    const mismatch = validateHandshake(
      { viewerVersion: "1.2.3", editorBuildId: "editor-aaa" },
      { viewerVersion: "2.0.0", editorBuildId: "editor-aaa" },
    );
    expect(mismatch).toContain("viewer 1.2.3");
    expect(mismatch).toContain("server is viewer 2.0.0");
  });

  it("fails when editor build id mismatches", () => {
    const mismatch = validateHandshake(
      { viewerVersion: "1.2.3", editorBuildId: "editor-aaa" },
      { viewerVersion: "1.2.3", editorBuildId: "editor-bbb" },
    );
    expect(mismatch).toContain("editor editor-aaa");
    expect(mismatch).toContain("editor editor-bbb");
  });
});
