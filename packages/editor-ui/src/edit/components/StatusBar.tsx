import { formatDuration } from "../slotRuntime";
import { Button } from "./ui/Button";

type StatusBarProps = {
  canSave: boolean;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  saveLabel: string;
  fileName: string;
  docTitle: string;
  revisionLabel: string;
  dirty: boolean;
  onOpenDocSettings: () => void;
  diagnosticsCount: number;
  onOpenDiagnostics: () => void;
  connectionLabel: string;
  runtime: { docstep: number; seed: number; timeSec: number };
};

export function StatusBar({
  canSave,
  onSave,
  onUndo,
  onRedo,
  saveLabel,
  fileName,
  docTitle,
  revisionLabel,
  dirty,
  onOpenDocSettings,
  diagnosticsCount,
  onOpenDiagnostics,
  connectionLabel,
  runtime,
}: StatusBarProps) {
  const timeLabel = formatDuration(runtime.timeSec);
  return (
    <div className="editor-statusbar" role="contentinfo">
      <div className="statusbar-left">
        <Button type="button" variant="ghost" size="sm" className="statusbar-button" onClick={onUndo}>
          Undo
        </Button>
        <Button type="button" variant="ghost" size="sm" className="statusbar-button" onClick={onRedo}>
          Redo
        </Button>
        <Button type="button" variant="ghost" size="sm" className="statusbar-button" onClick={onSave} disabled={!canSave}>
          Save
        </Button>
      </div>
      <button type="button" className="statusbar-center" onClick={onOpenDocSettings}>
        <span className="statusbar-filename">{fileName}</span>
        <span className="statusbar-title">{docTitle}</span>
        <span className="statusbar-revision">{revisionLabel}</span>
        {dirty ? <span className="statusbar-dirty" aria-label="Unsaved changes" /> : null}
      </button>
      <div className="statusbar-right">
        <Button type="button" variant="ghost" size="sm" className="statusbar-diagnostics" onClick={onOpenDiagnostics}>
          Diagnostics
          <span className="statusbar-badge" aria-label={`${diagnosticsCount} diagnostics`}>
            {diagnosticsCount}
          </span>
        </Button>
        <span className="statusbar-connection">{saveLabel}</span>
        <span className="statusbar-connection">{connectionLabel}</span>
        <span className="statusbar-runtime">
          <span>docstep {runtime.docstep}</span>
          <span>seed {runtime.seed}</span>
          <span>time {timeLabel}</span>
        </span>
      </div>
    </div>
  );
}
