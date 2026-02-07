import type { DocServiceState } from "../docService";

type TopBarProps = {
  docTitle?: string | null;
  docPath?: string | null;
  docState: DocServiceState;
  onReload: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
};

function getStatusLabel(state: DocServiceState): string {
  if (state.status === "error" || state.error) return "Error";
  if (state.isSaving || state.dirty) return "Saving…";
  return "Saved";
}

export default function TopBar({ docTitle, docPath, docState, onReload, onSave, onUndo, onRedo }: TopBarProps) {
  const name = docTitle ?? docPath ?? "Untitled document";
  const status = getStatusLabel(docState);

  return (
    <header className="editor-toolbar" role="toolbar">
      <div className="toolbar-left">
        <div className="toolbar-title">Flux Editor</div>
        <div className="toolbar-subtitle">{name}</div>
      </div>
      <div className="toolbar-center">
        <span className={`status-pill status-${status.toLowerCase().replace(/\W+/g, "-")}`}>{status}</span>
      </div>
      <div className="toolbar-actions">
        <button type="button" className="btn btn-ghost btn-xs" onClick={onReload}>
          Reload
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={onSave}
          disabled={!docState.doc?.source}
        >
          Save
        </button>
        <button type="button" className="btn btn-ghost btn-xs" onClick={onUndo}>
          Undo
        </button>
        <button type="button" className="btn btn-ghost btn-xs" onClick={onRedo}>
          Redo
        </button>
      </div>
    </header>
  );
}
