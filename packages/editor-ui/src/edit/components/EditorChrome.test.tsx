// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { coerceVersionInfo } from "@flux-lang/brand";
import { MenuBar } from "./MenuBar";
import { StatusBar } from "./StatusBar";
import type { EditorCommand, EditorCommandId } from "../commands/editorCommands";

const commandIds: EditorCommandId[] = [
  "app.about",
  "app.preferences",
  "app.shortcuts",
  "app.resetLayout",
  "app.openDocs",
  "app.reportIssue",
  "file.new",
  "file.open",
  "file.openRecent",
  "file.save",
  "file.saveAs",
  "file.revert",
  "file.settings",
  "file.exportPdf",
  "file.exportPng",
  "file.exportHtml",
  "file.close",
  "edit.undo",
  "edit.redo",
  "edit.cut",
  "edit.copy",
  "edit.paste",
  "edit.duplicate",
  "edit.delete",
  "edit.find",
  "edit.palette",
  "insert.page",
  "insert.section",
  "insert.text",
  "insert.figure",
  "insert.slot",
  "insert.callout",
  "insert.table",
  "insert.template",
  "format.applyStyle",
  "format.tokens",
  "format.styles",
  "view.toggleOutline",
  "view.toggleInspector",
  "view.toggleAssets",
  "view.toggleDiagnostics",
  "view.toggleConsole",
  "view.zoomIn",
  "view.zoomOut",
  "view.fitWidth",
  "view.fitPage",
  "view.toggleGuides",
  "view.toggleGrid",
  "view.toggleRulers",
  "view.previewMode",
  "view.editMode",
  "view.sourceMode",
  "view.showStatusBar",
  "runtime.playPause",
  "runtime.stepForward",
  "runtime.stepBack",
  "runtime.randomizeSeed",
  "runtime.setSeed",
  "runtime.jumpTime",
  "runtime.resetTime",
  "window.defaultLayout",
  "window.writingLayout",
  "window.debugLayout",
  "window.focusMode",
  "help.docs",
  "help.troubleshooting",
  "help.buildInfo",
  "help.copyDiagnostics",
];

function buildCommandMap(overrides: Partial<Record<EditorCommandId, Partial<EditorCommand>>> = {}) {
  return commandIds.reduce((acc, id) => {
    acc[id] = {
      id,
      label: id,
      enabled: true,
      run: vi.fn(),
      ...overrides[id],
    };
    return acc;
  }, {} as Record<EditorCommandId, EditorCommand>);
}

describe("editor header chrome", () => {
  it("keeps the menu bar stable across selection changes", () => {
    const commands = buildCommandMap();
    const { rerender } = render(
      <MenuBar
        commands={commands}
        checked={{
          "view.toggleOutline": true,
          "view.toggleInspector": true,
          "view.toggleAssets": true,
          "view.toggleDiagnostics": false,
          "view.showStatusBar": true,
        }}
        brandInfo={coerceVersionInfo({ version: "0.1.4" })}
      />,
    );

    const menubar = screen.getByRole("menubar");
    expect(within(menubar).getByTestId("flux-wordmark")).toBeTruthy();
    expect(within(menubar).getByText("v0.1.4")).toBeTruthy();
    const labels = ["File", "Edit", "Insert", "Format", "View", "Runtime", "Window", "Help"];
    labels.forEach((label) => expect(within(menubar).getByText(label)).toBeTruthy());
    expect(within(menubar).queryByText(/Delete/i)).toBeNull();

    const updatedCommands = buildCommandMap({
      "edit.delete": { enabled: false },
    });

    rerender(
      <MenuBar
        commands={updatedCommands}
        checked={{
          "view.toggleOutline": true,
          "view.toggleInspector": false,
          "view.toggleAssets": true,
          "view.toggleDiagnostics": false,
          "view.showStatusBar": true,
        }}
        brandInfo={coerceVersionInfo({ version: "0.1.4" })}
      />,
    );

    expect(within(menubar).getByTestId("flux-wordmark")).toBeTruthy();
    labels.forEach((label) => expect(within(menubar).getByText(label)).toBeTruthy());
  });

  it("renders the status bar truth layer and diagnostics action", () => {
    const onDiagnostics = vi.fn();
    const onSave = vi.fn();
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const onDocSettings = vi.fn();

    render(
      <StatusBar
        canSave
        onSave={onSave}
        onUndo={onUndo}
        onRedo={onRedo}
        saveLabel="Saved ✓"
        fileName="doc.flux"
        docTitle="Quarterly Report"
        revisionLabel="rev 24"
        dirty
        onOpenDocSettings={onDocSettings}
        diagnosticsCount={3}
        onOpenDiagnostics={onDiagnostics}
        connectionLabel="Local"
        runtime={{ docstep: 7, seed: 42, timeSec: 12.5 }}
      />,
    );

    expect(screen.getByText("doc.flux")).toBeTruthy();
    expect(screen.getByText("Quarterly Report")).toBeTruthy();
    expect(screen.getByText("rev 24")).toBeTruthy();
    expect(screen.getByText("docstep 7")).toBeTruthy();
    expect(screen.getByText("seed 42")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Diagnostics/i }));
    expect(onDiagnostics).toHaveBeenCalledTimes(1);

    const saveButton = screen.getByText("Save").closest("button");
    const undoButton = screen.getByText("Undo").closest("button");
    const redoButton = screen.getByText("Redo").closest("button");

    expect(saveButton).not.toBeNull();
    expect(undoButton).not.toBeNull();
    expect(redoButton).not.toBeNull();

    fireEvent.click(saveButton as HTMLButtonElement);
    expect(onSave).toHaveBeenCalledTimes(1);

    fireEvent.click(undoButton as HTMLButtonElement);
    expect(onUndo).toHaveBeenCalledTimes(1);

    fireEvent.click(redoButton as HTMLButtonElement);
    expect(onRedo).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /doc.flux/i }));
    expect(onDocSettings).toHaveBeenCalledTimes(1);
  });
});
