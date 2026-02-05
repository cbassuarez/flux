import { toolbarButton } from "./ToolbarButton.js";
import { toolbarGroup } from "./ToolbarGroup.js";
import { renderOverflowMenu } from "./OverflowMenu.js";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const renderViewerToolbar = (initialTitle: string): string => {
  const left = [
    '<div class="viewer-doc">',
    `  <div class="viewer-title" id="viewer-title" title="${escapeHtml(initialTitle)}">${escapeHtml(initialTitle)}</div>`,
    '  <div class="viewer-meta">',
    '    <span class="viewer-live is-live" id="viewer-live">',
    '      <span class="viewer-live__dot" aria-hidden="true">●</span>',
    '      <span class="viewer-live__label">Live</span>',
    "    </span>",
    '    <span class="viewer-metrics" id="viewer-metrics">',
    '      <span class="viewer-metrics__full" id="viewer-metrics-full">seed 0 · docstep 0 · t 0.0s</span>',
    '      <span class="viewer-metrics__compact" id="viewer-metrics-compact">s0 · d0 · t0.0s</span>',
    "    </span>",
    "  </div>",
    "</div>",
  ].join("\n");

  const transportButtons = [
    toolbarButton({
      id: "viewer-reset",
      label: "Reset",
      icon: "⟲",
      title: "Reset (R)",
      ariaLabel: "Reset",
      variant: "segmented",
      iconOnly: true,
    }),
    toolbarButton({
      id: "viewer-step-back",
      label: "Step back",
      icon: "⏮",
      title: "Step back (←)",
      ariaLabel: "Step back",
      variant: "segmented",
      iconOnly: true,
    }),
    toolbarButton({
      id: "viewer-toggle",
      label: "Pause",
      icon: "⏸",
      title: "Play/Pause (Space)",
      ariaLabel: "Play or pause",
      variant: "segmented",
      className: "is-active",
      iconOnly: true,
    }),
    toolbarButton({
      id: "viewer-step-forward",
      label: "Step forward",
      icon: "⏭",
      title: "Step forward (→)",
      ariaLabel: "Step forward",
      variant: "segmented",
      iconOnly: true,
    }),
  ].join("\n");

  const speedControl = [
    '<div class="toolbar-speed" aria-label="Playback speed">',
    '  <span class="toolbar-speed__label">Speed</span>',
    '  <select id="viewer-interval" class="toolbar-select" aria-label="Playback interval">',
    '    <option value="700">700ms</option>',
    '    <option value="1000">1s</option>',
    '    <option value="2000">2s</option>',
    '    <option value="5000">5s</option>',
    "  </select>",
    "</div>",
  ].join("\n");

  const transport = toolbarGroup({
    className: "toolbar-segmented",
    role: "group",
    ariaLabel: "Transport controls",
    children: `${transportButtons}\n${speedControl}`,
  });

  const right = [
    toolbarButton({
      id: "viewer-export",
      label: "Export PDF",
      icon: "⇩",
      title: "Export PDF (E)",
      ariaLabel: "Export PDF",
      variant: "primary",
    }),
    renderOverflowMenu(),
  ].join("\n");

  return [
    '<header class="viewer-toolbar" id="viewer-toolbar" role="toolbar">',
    `  <div class="viewer-toolbar__zone viewer-toolbar__zone--left">${left}</div>`,
    `  <div class="viewer-toolbar__zone viewer-toolbar__zone--center">${transport}</div>`,
    `  <div class="viewer-toolbar__zone viewer-toolbar__zone--right">${right}</div>`,
    "</header>",
  ].join("\n");
};

export const viewerToolbarCss = `
.viewer-toolbar {
  position: sticky;
  top: 0;
  z-index: 20;
  height: var(--viewer-toolbar-height);
  display: grid;
  grid-template-columns: minmax(200px, 1fr) auto minmax(200px, 1fr);
  align-items: center;
  gap: var(--viewer-space-4);
  padding: 0 var(--viewer-space-5);
  background: var(--viewer-panel);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--viewer-border);
  transition: box-shadow 0.2s ease;
}

.viewer-toolbar.is-shadow {
  box-shadow: var(--viewer-shadow-toolbar);
}

.viewer-toolbar__zone {
  min-width: 0;
  display: flex;
  align-items: center;
}

.viewer-toolbar__zone--left {
  justify-content: flex-start;
}

.viewer-toolbar__zone--center {
  justify-content: center;
}

.viewer-toolbar__zone--right {
  justify-content: flex-end;
  gap: var(--viewer-space-3);
}

.viewer-doc {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.viewer-title {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--viewer-text);
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.viewer-meta {
  display: flex;
  align-items: center;
  gap: var(--viewer-space-3);
  font-size: 12px;
  color: var(--viewer-muted);
  white-space: nowrap;
  min-width: 0;
}

.viewer-live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.viewer-live__dot {
  font-size: 10px;
  line-height: 1;
}

.viewer-live.is-live {
  color: var(--viewer-accent-strong);
}

.viewer-live.is-paused {
  color: var(--viewer-muted);
}

.viewer-metrics {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--viewer-chip-bg);
  border: 1px solid var(--viewer-border);
  font-variant-numeric: tabular-nums;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-metrics__compact {
  display: none;
}

.toolbar-group {
  display: inline-flex;
  align-items: center;
}

.toolbar-segmented {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: var(--viewer-radius-lg);
  background: var(--viewer-surface-strong);
  border: 1px solid var(--viewer-border);
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--viewer-radius-md);
  border: 1px solid transparent;
  background: transparent;
  color: var(--viewer-text);
  font-size: 12px;
  font-weight: 600;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.2s ease;
}

.toolbar-btn:hover {
  border-color: var(--viewer-border);
  background: var(--viewer-surface);
}

.toolbar-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.toolbar-btn:focus-visible {
  outline: 2px solid var(--viewer-accent);
  outline-offset: 2px;
}

.toolbar-btn--icon {
  width: 30px;
  padding: 0;
}

.toolbar-btn--segmented {
  border-color: transparent;
}

.toolbar-btn--segmented.is-active {
  background: var(--viewer-accent-soft);
  border-color: var(--viewer-accent);
  color: var(--viewer-accent-strong);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.6);
}

.toolbar-btn--primary {
  height: 30px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: var(--viewer-accent-gradient);
  color: #041314;
  font-weight: 700;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.toolbar-btn--primary:hover {
  filter: brightness(1.02);
}

.toolbar-icon {
  font-size: 14px;
  line-height: 1;
}

.toolbar-speed {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px 0 12px;
  border-left: 1px solid var(--viewer-border);
  height: 28px;
}

.toolbar-speed__label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--viewer-muted-strong);
}

.toolbar-select {
  border: 1px solid var(--viewer-border);
  background: var(--viewer-surface);
  color: var(--viewer-text);
  border-radius: var(--viewer-radius-sm);
  padding: 3px 20px 3px 8px;
  font-size: 12px;
  font-weight: 600;
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--viewer-muted) 50%),
    linear-gradient(135deg, var(--viewer-muted) 50%, transparent 50%);
  background-position: calc(100% - 12px) 55%, calc(100% - 8px) 55%;
  background-size: 4px 4px, 4px 4px;
  background-repeat: no-repeat;
}

.toolbar-select:focus-visible {
  outline: 2px solid var(--viewer-accent);
  outline-offset: 2px;
}

.toolbar-overflow {
  position: relative;
}

.toolbar-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  min-width: 240px;
  padding: 10px;
  border-radius: 12px;
  background: var(--viewer-panel-solid);
  border: 1px solid var(--viewer-border);
  box-shadow: var(--viewer-shadow-soft);
  display: none;
  gap: 10px;
}

.toolbar-overflow.is-open .toolbar-menu {
  display: grid;
}

.toolbar-menu__section {
  display: grid;
  gap: 8px;
}

.toolbar-menu__title {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--viewer-muted-strong);
}

.toolbar-menu__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--viewer-text);
}

.toolbar-menu__label {
  color: var(--viewer-muted-strong);
}

.toolbar-menu__value {
  font-variant-numeric: tabular-nums;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-menu__toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--viewer-text);
}

.toolbar-menu__toggle input {
  accent-color: var(--viewer-accent);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 900px) {
  .viewer-metrics__full {
    display: none;
  }

  .viewer-metrics__compact {
    display: inline;
  }
}

@media (max-width: 780px) {
  .toolbar-speed__label {
    display: none;
  }
}

@media (max-width: 720px) {
  .toolbar-btn--primary .toolbar-btn__label {
    display: none;
  }

  .toolbar-btn--primary {
    width: 34px;
    padding: 0;
    border-radius: 10px;
  }

  .viewer-meta {
    gap: var(--viewer-space-2);
  }
}

@media (max-width: 620px) {
  .viewer-live__label {
    display: none;
  }
}

@media (max-width: 560px) {
  .viewer-toolbar {
    grid-template-columns: minmax(140px, 1fr) auto minmax(120px, 1fr);
    padding: 0 var(--viewer-space-3);
  }

  .viewer-toolbar__zone--right {
    gap: var(--viewer-space-2);
  }

  .toolbar-segmented {
    padding: 1px;
  }

  .toolbar-btn--icon {
    width: 28px;
  }
}
`;
