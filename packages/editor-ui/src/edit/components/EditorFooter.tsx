type EditorFooterProps = {
  docTitle: string;
  docPath?: string;
  saveState: "saved" | "dirty" | "error";
  modeLabel: string;
  breadcrumb?: string;
  playbackReadout?: string;
  diagnosticsSummary: { errors: number; warnings: number };
  onOpenDiagnostics: () => void;
  onOpenShortcuts?: () => void;
};

const saveStateLabel: Record<EditorFooterProps["saveState"], string> = {
  saved: "Saved",
  dirty: "Unsaved",
  error: "Save error",
};

export function EditorFooter({
  docTitle,
  docPath,
  saveState,
  modeLabel,
  breadcrumb,
  playbackReadout,
  diagnosticsSummary,
  onOpenDiagnostics,
}: EditorFooterProps) {
  return (
    <footer className="editor-footer" role="contentinfo">
      <div className="footer-zone footer-left">
        <span className="footer-title" title={docTitle}>
          {docTitle}
        </span>
        {docPath ? (
          <span className="footer-path" title={docPath}>
            {docPath}
          </span>
        ) : null}
        <span className={`footer-chip footer-save footer-save-${saveState}`}>{saveStateLabel[saveState]}</span>
        <span className="footer-chip footer-mode">{modeLabel}</span>
      </div>
      <div className="footer-zone footer-center">
        {breadcrumb ? (
          <span className="footer-breadcrumb" title={breadcrumb}>
            {breadcrumb}
          </span>
        ) : null}
        {playbackReadout ? <span className="footer-playback">{playbackReadout}</span> : null}
      </div>
      <div className="footer-zone footer-right">
        <button
          type="button"
          className="footer-diagnostics"
          onClick={onOpenDiagnostics}
          aria-label="Open diagnostics"
        >
          <span className="footer-diagnostics-item">Errors {diagnosticsSummary.errors}</span>
          <span className="footer-diagnostics-item">Warnings {diagnosticsSummary.warnings}</span>
        </button>
        <span className="footer-shortcuts" aria-hidden="true">
          ⌘K ⌘F
        </span>
      </div>
    </footer>
  );
}
