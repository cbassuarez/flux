import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { App } from "../src/ui/app.js";
import { getLayoutMetrics } from "../src/ui/layout.js";

vi.mock("@flux-lang/cli-core", () => ({
  getRecentsStore: vi.fn().mockResolvedValue({ entries: [], storePath: "/tmp/recents.json" }),
  updateRecents: vi.fn(),
  getPinnedDirsStore: vi.fn().mockResolvedValue({ entries: [] }),
  addPinnedDir: vi.fn(),
  removePinnedDir: vi.fn(),
  getLastUsedDirStore: vi.fn().mockResolvedValue({ dir: null }),
  setLastUsedDir: vi.fn().mockResolvedValue({ dir: null }),
  indexFiles: vi.fn().mockImplementation(async function* () {
    yield { type: "done", truncated: false };
  }),
  walkFilesFromFs: vi.fn().mockReturnValue((async function* () {})()),
  resolveConfig: vi.fn().mockResolvedValue({ config: {} }),
  viewCommand: vi.fn().mockResolvedValue({ ok: false }),
  pdfCommand: vi.fn().mockResolvedValue({ ok: false }),
  checkCommand: vi.fn().mockResolvedValue({ ok: false }),
  formatCommand: vi.fn().mockResolvedValue({ ok: false }),
  addCommand: vi.fn().mockResolvedValue({ ok: false }),
  newCommand: vi.fn().mockResolvedValue({ ok: false }),
  fetchViewerPatch: vi.fn().mockResolvedValue(null),
  fetchViewerStatus: vi.fn().mockResolvedValue({}),
  requestViewerPdf: vi.fn().mockResolvedValue(null),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readdir: vi.fn().mockResolvedValue([]),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("layout", () => {
  it("renders dashboard at 80x24", () => {
    const { lastFrame, unmount } = render(<App cwd="/tmp" />, { columns: 80, rows: 24 });
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Navigation");
    expect(frame).toContain("Open");
    expect(frame).not.toContain("Terminal too small");
    unmount();
  });

  it("renders too-small view at 60x20", () => {
    const { lastFrame, unmount } = render(<App cwd="/tmp" />, { columns: 60, rows: 20 });
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Terminal too small");
    unmount();
  });

  it("renders dashboard at 120x40", () => {
    const { lastFrame, unmount } = render(<App cwd="/tmp" />, { columns: 120, rows: 40 });
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Navigation");
    expect(frame).toContain("Open");
    expect(frame).not.toContain("Terminal too small");
    unmount();
  });

  it("never computes negative widths", () => {
    const metrics = getLayoutMetrics(60, 20);
    expect(metrics.innerWidth).toBeGreaterThanOrEqual(0);
    expect(metrics.overlayWidth).toBeGreaterThanOrEqual(0);
    expect(metrics.navWidth).toBeGreaterThanOrEqual(0);
    expect(metrics.paneWidth).toBeGreaterThanOrEqual(0);
    expect(metrics.navContentWidth).toBeGreaterThanOrEqual(0);
    expect(metrics.paneContentWidth).toBeGreaterThanOrEqual(0);
    expect(metrics.navListHeight).toBeGreaterThanOrEqual(0);
  });
});
