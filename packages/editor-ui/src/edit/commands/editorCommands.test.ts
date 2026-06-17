import { describe, it, expect } from "vitest";
import { buildEditorCommands, type EditorCommandContext } from "./editorCommands";

// A "maximally enabling" context: dirty + a selection so that commands which are
// only *conditionally* disabled (Save, Revert, Duplicate, Delete) are enabled.
// Anything still disabled is therefore a structurally dead command, which must be
// marked `planned`.
function mockContext(): EditorCommandContext {
  const noop = () => {};
  return {
    docState: { dirty: true, selection: { kind: "node", id: "node1" } },
    undo: noop,
    redo: noop,
    isSourceEditorDirty: true,
    runtimeState: { mode: "edit", docstep: 0, seed: 0, timeSec: 0 },
    runtimeActions: {
      setMode: noop,
      togglePlay: noop,
      setDocstep: noop,
      setSeed: noop,
      setTimeSec: noop,
    },
    selectionId: "node1",
    handleDuplicate: noop,
    handleDelete: noop,
    handleSave: noop,
    handleRevert: noop,
    handleExportPdf: noop,
    handleExportHtml: noop,
    handleResetLayout: noop,
    applyWritingLayout: noop,
    applyDebugLayout: noop,
    zoomIn: noop,
    zoomOut: noop,
    fitWidth: noop,
    fitPage: noop,
    openDocs: noop,
    reportIssue: noop,
    handleInsertPage: noop,
    handleInsertSection: noop,
    handleInsertParagraph: noop,
    handleInsertFigure: noop,
    handleInsertSlot: noop,
    handleInsertCallout: noop,
    handleInsertTable: noop,
    setFindOpen: noop,
    setPaletteOpen: noop,
    setActiveMode: noop,
    toggleOutline: noop,
    toggleInspector: noop,
    toggleAssets: noop,
    toggleDiagnostics: noop,
    toggleStatusBar: noop,
    toggleGuides: noop,
    toggleGrid: noop,
    toggleRulers: noop,
    enterFocusMode: noop,
    openAbout: noop,
    openDocSettings: noop,
    openBuildInfo: noop,
    copyDiagnostics: noop,
  } as unknown as EditorCommandContext;
}

describe("editor command integrity", () => {
  const commands = Object.values(buildEditorCommands(mockContext()));

  it("has no dead command: every disabled command is explicitly planned", () => {
    const deadButNotPlanned = commands.filter((c) => !c.enabled && !c.planned).map((c) => c.id);
    expect(deadButNotPlanned, "These disabled commands must be marked `planned` or implemented").toEqual([]);
  });

  it("never marks a planned command as enabled", () => {
    const plannedButEnabled = commands.filter((c) => c.planned && c.enabled).map((c) => c.id);
    expect(plannedButEnabled).toEqual([]);
  });

  it("every command has a non-empty label and a run function", () => {
    for (const command of commands) {
      expect(command.label.length).toBeGreaterThan(0);
      expect(typeof command.run).toBe("function");
    }
  });
});
