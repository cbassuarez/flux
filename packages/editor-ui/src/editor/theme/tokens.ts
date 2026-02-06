export const editorTokens = {
  surfaces: {
    app: "var(--editor-surface-app)",
    panel: "var(--editor-surface-panel)",
    desk: "var(--editor-surface-desk)",
    paper: "var(--editor-surface-paper)",
    hover: "var(--editor-surface-hover)",
    scrim: "var(--editor-surface-scrim)",
  },
  text: {
    fg: "var(--editor-text-fg)",
    muted: "var(--editor-text-muted)",
    ink: "var(--editor-text-ink)",
  },
  lines: {
    hairline: "var(--editor-line-hairline)",
    muted: "var(--editor-line-muted)",
    paper: "var(--editor-line-paper)",
  },
  accent: {
    base: "var(--editor-accent)",
    strong: "var(--editor-accent-strong)",
    gradient: "var(--editor-accent-gradient)",
    muted: "var(--editor-accent-muted)",
  },
  status: {
    ok: "var(--editor-status-ok)",
    warn: "var(--editor-status-warn)",
    error: "var(--editor-status-error)",
  },
  radius: {
    xs: "var(--editor-radius-xs)",
    sm: "var(--editor-radius-sm)",
    md: "var(--editor-radius-md)",
    lg: "var(--editor-radius-lg)",
  },
  space: {
    x1: "var(--editor-space-1)",
    x2: "var(--editor-space-2)",
    x3: "var(--editor-space-3)",
    x4: "var(--editor-space-4)",
  },
  font: {
    ui: "var(--editor-font-ui)",
    doc: "var(--editor-font-doc)",
  },
} as const;
