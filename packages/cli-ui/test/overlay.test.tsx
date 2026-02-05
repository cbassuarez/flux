import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { CommandPaletteModal } from "../src/components/CommandPaletteModal.js";
import { isModalFocus } from "../src/state/focus.js";
import { ModalOverlay, buildFillLines } from "../src/ui/ModalOverlay.js";

describe("modal overlay", () => {
  it("builds a full scrim fill", () => {
    const fill = buildFillLines(6, 3);
    const lines = fill.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]?.length).toBe(6);
  });

  it("renders scrim content when open", () => {
    const { lastFrame, unmount } = render(
      <ModalOverlay isOpen title="Test" onRequestClose={() => {}}>
        <Text>Body</Text>
      </ModalOverlay>,
      { columns: 10, rows: 6 },
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain(" ".repeat(10));
    unmount();
  });
});

describe("focus gating", () => {
  it("treats palette focus as modal", () => {
    expect(isModalFocus("palette")).toBe(true);
  });

  it("treats help focus as modal", () => {
    expect(isModalFocus("help")).toBe(true);
  });
});

describe("command palette selection", () => {
  it("renders the accent bar on the selected row", () => {
    const { lastFrame, unmount } = render(
      <CommandPaletteModal
        query=""
        groups={[{ group: "Commands", items: [{ id: "open", label: "Open", group: "Commands", kind: "action" }] }]}
        selectedId="open"
        width={30}
      />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("▌");
    unmount();
  });
});
