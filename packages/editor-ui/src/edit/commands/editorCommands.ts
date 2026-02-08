import type { DocServiceState } from "../docService";
import type { EditorRuntimeActions, EditorRuntimeState } from "../runtimeContext";

export type EditorCommandId =
  | "app.about"
  | "app.preferences"
  | "app.shortcuts"
  | "app.resetLayout"
  | "app.openDocs"
  | "app.reportIssue"
  | "file.new"
  | "file.open"
  | "file.openRecent"
  | "file.save"
  | "file.saveAs"
  | "file.revert"
  | "file.settings"
  | "file.exportPdf"
  | "file.exportPng"
  | "file.exportHtml"
  | "file.close"
  | "edit.undo"
  | "edit.redo"
  | "edit.cut"
  | "edit.copy"
  | "edit.paste"
  | "edit.duplicate"
  | "edit.delete"
  | "edit.find"
  | "edit.palette"
  | "insert.page"
  | "insert.section"
  | "insert.text"
  | "insert.figure"
  | "insert.slot"
  | "insert.callout"
  | "insert.table"
  | "insert.template"
  | "format.applyStyle"
  | "format.tokens"
  | "format.styles"
  | "view.toggleOutline"
  | "view.toggleInspector"
  | "view.toggleAssets"
  | "view.toggleDiagnostics"
  | "view.toggleConsole"
  | "view.zoomIn"
  | "view.zoomOut"
  | "view.fitWidth"
  | "view.fitPage"
  | "view.toggleGuides"
  | "view.toggleGrid"
  | "view.toggleRulers"
  | "view.previewMode"
  | "view.editMode"
  | "view.sourceMode"
  | "view.showStatusBar"
  | "runtime.playPause"
  | "runtime.stepForward"
  | "runtime.stepBack"
  | "runtime.randomizeSeed"
  | "runtime.setSeed"
  | "runtime.jumpTime"
  | "runtime.resetTime"
  | "window.defaultLayout"
  | "window.writingLayout"
  | "window.debugLayout"
  | "window.focusMode"
  | "help.docs"
  | "help.troubleshooting"
  | "help.buildInfo"
  | "help.copyDiagnostics";

export type EditorCommand = {
  id: EditorCommandId;
  label: string;
  shortcut?: string;
  enabled: boolean;
  run: () => void;
  palette?: boolean;
  group?: string;
};

export type EditorCommandContext = {
  docState: DocServiceState;
  undo: () => void;
  redo: () => void;
  sourceDirty: boolean;
  runtimeState: EditorRuntimeState;
  runtimeActions: EditorRuntimeActions;
  selectionId: string | null;
  handleSave: () => void;
  handleExportPdf: () => void;
  handleResetLayout: () => void;
  handleInsertPage: () => void;
  handleInsertSection: () => void;
  handleInsertParagraph: () => void;
  handleInsertFigure: () => void;
  handleInsertSlot: () => void;
  handleInsertCallout: () => void;
  handleInsertTable: () => void;
  setFindOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  setActiveMode: (mode: "preview" | "edit" | "source") => void;
  toggleOutline: () => void;
  toggleInspector: () => void;
  toggleAssets: () => void;
  toggleDiagnostics: () => void;
  toggleStatusBar: () => void;
  enterFocusMode: () => void;
  openAbout: () => void;
  openDocSettings: () => void;
  openBuildInfo: () => void;
  copyDiagnostics: () => void;
};

export function buildEditorCommands(ctx: EditorCommandContext): Record<EditorCommandId, EditorCommand> {
  const make = (command: EditorCommand) => command;
  return {
    "app.about": make({
      id: "app.about",
      label: "About Flux Editor",
      enabled: true,
      run: ctx.openAbout,
      palette: false,
    }),
    "app.preferences": make({
      id: "app.preferences",
      label: "Preferences…",
      enabled: false,
      run: () => {},
      palette: false,
    }),
    "app.shortcuts": make({
      id: "app.shortcuts",
      label: "Keyboard Shortcuts",
      enabled: true,
      run: () => ctx.setPaletteOpen(true),
      palette: false,
    }),
    "app.resetLayout": make({
      id: "app.resetLayout",
      label: "Reset Layout",
      enabled: true,
      run: ctx.handleResetLayout,
      palette: false,
    }),
    "app.openDocs": make({
      id: "app.openDocs",
      label: "Open Docs",
      enabled: false,
      run: () => {},
      palette: false,
    }),
    "app.reportIssue": make({
      id: "app.reportIssue",
      label: "Report Issue",
      enabled: false,
      run: () => {},
      palette: false,
    }),
    "file.new": make({
      id: "file.new",
      label: "New",
      enabled: false,
      run: () => {},
    }),
    "file.open": make({
      id: "file.open",
      label: "Open…",
      enabled: false,
      run: () => {},
    }),
    "file.openRecent": make({
      id: "file.openRecent",
      label: "Open Recent",
      enabled: false,
      run: () => {},
    }),
    "file.save": make({
      id: "file.save",
      label: "Save",
      shortcut: "⌘S",
      enabled: ctx.sourceDirty || ctx.docState.dirty,
      run: ctx.handleSave,
      group: "File",
    }),
    "file.saveAs": make({
      id: "file.saveAs",
      label: "Save As…",
      enabled: false,
      run: () => {},
    }),
    "file.revert": make({
      id: "file.revert",
      label: "Revert to Saved",
      enabled: false,
      run: () => {},
    }),
    "file.settings": make({
      id: "file.settings",
      label: "Document Settings…",
      enabled: true,
      run: ctx.openDocSettings,
      group: "File",
    }),
    "file.exportPdf": make({
      id: "file.exportPdf",
      label: "Export PDF",
      enabled: true,
      run: ctx.handleExportPdf,
      group: "File",
    }),
    "file.exportPng": make({
      id: "file.exportPng",
      label: "Export PNG",
      enabled: false,
      run: () => {},
    }),
    "file.exportHtml": make({
      id: "file.exportHtml",
      label: "Export HTML",
      enabled: false,
      run: () => {},
    }),
    "file.close": make({
      id: "file.close",
      label: "Close Document",
      enabled: false,
      run: () => {},
    }),
    "edit.undo": make({
      id: "edit.undo",
      label: "Undo",
      shortcut: "⌘Z",
      enabled: true,
      run: ctx.undo,
      group: "Edit",
    }),
    "edit.redo": make({
      id: "edit.redo",
      label: "Redo",
      shortcut: "⇧⌘Z",
      enabled: true,
      run: ctx.redo,
      group: "Edit",
    }),
    "edit.cut": make({
      id: "edit.cut",
      label: "Cut",
      shortcut: "⌘X",
      enabled: false,
      run: () => {},
    }),
    "edit.copy": make({
      id: "edit.copy",
      label: "Copy",
      shortcut: "⌘C",
      enabled: false,
      run: () => {},
    }),
    "edit.paste": make({
      id: "edit.paste",
      label: "Paste",
      shortcut: "⌘V",
      enabled: false,
      run: () => {},
    }),
    "edit.duplicate": make({
      id: "edit.duplicate",
      label: "Duplicate",
      shortcut: "⌘D",
      enabled: Boolean(ctx.selectionId),
      run: () => {},
    }),
    "edit.delete": make({
      id: "edit.delete",
      label: "Delete",
      shortcut: "⌫",
      enabled: Boolean(ctx.selectionId),
      run: () => {},
    }),
    "edit.find": make({
      id: "edit.find",
      label: "Find…",
      shortcut: "⌘F",
      enabled: true,
      run: () => ctx.setFindOpen(true),
      group: "Edit",
    }),
    "edit.palette": make({
      id: "edit.palette",
      label: "Command Palette…",
      shortcut: "⌘K",
      enabled: true,
      run: () => ctx.setPaletteOpen(true),
      group: "Edit",
    }),
    "insert.page": make({
      id: "insert.page",
      label: "Page",
      enabled: true,
      run: ctx.handleInsertPage,
      group: "Insert",
    }),
    "insert.section": make({
      id: "insert.section",
      label: "Section",
      enabled: true,
      run: ctx.handleInsertSection,
      group: "Insert",
    }),
    "insert.text": make({
      id: "insert.text",
      label: "Text / Paragraph",
      enabled: true,
      run: ctx.handleInsertParagraph,
      group: "Insert",
    }),
    "insert.figure": make({
      id: "insert.figure",
      label: "Figure",
      enabled: true,
      run: ctx.handleInsertFigure,
      group: "Insert",
    }),
    "insert.slot": make({
      id: "insert.slot",
      label: "Slot",
      enabled: true,
      run: ctx.handleInsertSlot,
      group: "Insert",
    }),
    "insert.callout": make({
      id: "insert.callout",
      label: "Callout",
      enabled: true,
      run: ctx.handleInsertCallout,
      group: "Insert",
    }),
    "insert.table": make({
      id: "insert.table",
      label: "Table",
      enabled: true,
      run: ctx.handleInsertTable,
      group: "Insert",
    }),
    "insert.template": make({
      id: "insert.template",
      label: "Template…",
      enabled: false,
      run: () => {},
      group: "Insert",
    }),
    "format.applyStyle": make({
      id: "format.applyStyle",
      label: "Apply Style…",
      enabled: false,
      run: () => {},
      group: "Format",
    }),
    "format.tokens": make({
      id: "format.tokens",
      label: "Tokens Panel",
      enabled: false,
      run: () => {},
      group: "Format",
    }),
    "format.styles": make({
      id: "format.styles",
      label: "Styles Panel",
      enabled: false,
      run: () => {},
      group: "Format",
    }),
    "view.toggleOutline": make({
      id: "view.toggleOutline",
      label: "Outline",
      enabled: true,
      run: ctx.toggleOutline,
      palette: false,
    }),
    "view.toggleInspector": make({
      id: "view.toggleInspector",
      label: "Inspector",
      enabled: true,
      run: ctx.toggleInspector,
      palette: false,
    }),
    "view.toggleAssets": make({
      id: "view.toggleAssets",
      label: "Assets",
      enabled: true,
      run: ctx.toggleAssets,
      palette: false,
    }),
    "view.toggleDiagnostics": make({
      id: "view.toggleDiagnostics",
      label: "Diagnostics",
      enabled: true,
      run: ctx.toggleDiagnostics,
      palette: false,
    }),
    "view.toggleConsole": make({
      id: "view.toggleConsole",
      label: "Console",
      enabled: false,
      run: () => {},
      palette: false,
    }),
    "view.zoomIn": make({
      id: "view.zoomIn",
      label: "Zoom In",
      shortcut: "⌘+",
      enabled: false,
      run: () => {},
    }),
    "view.zoomOut": make({
      id: "view.zoomOut",
      label: "Zoom Out",
      shortcut: "⌘-",
      enabled: false,
      run: () => {},
    }),
    "view.fitWidth": make({
      id: "view.fitWidth",
      label: "Fit Width",
      enabled: false,
      run: () => {},
    }),
    "view.fitPage": make({
      id: "view.fitPage",
      label: "Fit Page",
      enabled: false,
      run: () => {},
    }),
    "view.toggleGuides": make({
      id: "view.toggleGuides",
      label: "Toggle Guides",
      enabled: false,
      run: () => {},
    }),
    "view.toggleGrid": make({
      id: "view.toggleGrid",
      label: "Toggle Grid",
      enabled: false,
      run: () => {},
    }),
    "view.toggleRulers": make({
      id: "view.toggleRulers",
      label: "Toggle Rulers",
      enabled: false,
      run: () => {},
    }),
    "view.previewMode": make({
      id: "view.previewMode",
      label: "Preview Mode",
      enabled: true,
      run: () => ctx.setActiveMode("preview"),
      palette: false,
    }),
    "view.editMode": make({
      id: "view.editMode",
      label: "Edit Mode",
      enabled: true,
      run: () => ctx.setActiveMode("edit"),
      palette: false,
    }),
    "view.sourceMode": make({
      id: "view.sourceMode",
      label: "Source Mode",
      enabled: true,
      run: () => ctx.setActiveMode("source"),
      palette: false,
    }),
    "view.showStatusBar": make({
      id: "view.showStatusBar",
      label: "Show Status Bar",
      enabled: true,
      run: ctx.toggleStatusBar,
      palette: false,
    }),
    "runtime.playPause": make({
      id: "runtime.playPause",
      label: "Play/Pause Simulation",
      enabled: true,
      run: () => {
        if (ctx.runtimeState.mode !== "playback") {
          ctx.runtimeActions.setMode("playback");
        }
        ctx.runtimeActions.togglePlay();
      },
      group: "Runtime",
    }),
    "runtime.stepForward": make({
      id: "runtime.stepForward",
      label: "Step Docstep Forward",
      enabled: true,
      run: () => ctx.runtimeActions.setDocstep(ctx.runtimeState.docstep + 1),
      group: "Runtime",
    }),
    "runtime.stepBack": make({
      id: "runtime.stepBack",
      label: "Step Docstep Back",
      enabled: true,
      run: () => ctx.runtimeActions.setDocstep(ctx.runtimeState.docstep - 1),
      group: "Runtime",
    }),
    "runtime.randomizeSeed": make({
      id: "runtime.randomizeSeed",
      label: "Randomize Seed",
      enabled: true,
      run: () => ctx.runtimeActions.setSeed(Math.floor(Math.random() * 100000)),
      group: "Runtime",
    }),
    "runtime.setSeed": make({
      id: "runtime.setSeed",
      label: "Set Seed…",
      enabled: true,
      run: () => {
        const raw = window.prompt("Seed value", String(ctx.runtimeState.seed));
        if (raw === null) return;
        const next = Number(raw);
        if (Number.isFinite(next)) ctx.runtimeActions.setSeed(next);
      },
      group: "Runtime",
    }),
    "runtime.jumpTime": make({
      id: "runtime.jumpTime",
      label: "Jump Time…",
      enabled: true,
      run: () => {
        const raw = window.prompt("Time (seconds)", String(ctx.runtimeState.timeSec));
        if (raw === null) return;
        const next = Number(raw);
        if (Number.isFinite(next)) ctx.runtimeActions.setTimeSec(next);
      },
      group: "Runtime",
    }),
    "runtime.resetTime": make({
      id: "runtime.resetTime",
      label: "Reset Time",
      enabled: true,
      run: () => ctx.runtimeActions.setTimeSec(0),
      group: "Runtime",
    }),
    "window.defaultLayout": make({
      id: "window.defaultLayout",
      label: "Default Layout",
      enabled: true,
      run: ctx.handleResetLayout,
      palette: false,
    }),
    "window.writingLayout": make({
      id: "window.writingLayout",
      label: "Writing Layout",
      enabled: false,
      run: () => {},
      palette: false,
    }),
    "window.debugLayout": make({
      id: "window.debugLayout",
      label: "Debug Layout",
      enabled: false,
      run: () => {},
      palette: false,
    }),
    "window.focusMode": make({
      id: "window.focusMode",
      label: "Focus Mode (Hide Side Panels)",
      enabled: true,
      run: ctx.enterFocusMode,
      palette: false,
    }),
    "help.docs": make({
      id: "help.docs",
      label: "Docs",
      enabled: false,
      run: () => {},
      palette: false,
    }),
    "help.troubleshooting": make({
      id: "help.troubleshooting",
      label: "Troubleshooting",
      enabled: false,
      run: () => {},
      palette: false,
    }),
    "help.buildInfo": make({
      id: "help.buildInfo",
      label: "Version / Build Info…",
      enabled: true,
      run: ctx.openBuildInfo,
      palette: false,
    }),
    "help.copyDiagnostics": make({
      id: "help.copyDiagnostics",
      label: "Copy Diagnostics Summary",
      enabled: true,
      run: ctx.copyDiagnostics,
      palette: false,
    }),
  };
}
