import React, { useEffect, useMemo, useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { ScoreGrid } from './components/ScoreGrid';
import { applyLocalEdit } from './domain/actions';
import { createInitialScoreState } from './domain/bootstrap';
import { advanceScoreOneStep } from './domain/engine';
import { LocalEditAction } from './domain/actions';
import { ScoreState } from './domain/flux';

function useAutoAdvance(
  enabled: boolean,
  state: ScoreState,
  setState: React.Dispatch<React.SetStateAction<ScoreState>>
) {
  useEffect(() => {
    if (!enabled || state.globalControls.evolutionRate <= 0) return;
    const intervalMs = Math.max(300, 1200 / Math.max(0.2, state.globalControls.evolutionRate));
    const id = setInterval(() => {
      setState((prev) => advanceScoreOneStep(prev));
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, setState, state.globalControls.evolutionRate]);
}

function ActionDrawer({
  cellId,
  state,
  improvText,
  setImprovText,
  onAction
}: {
  cellId?: string;
  state: ScoreState;
  improvText: string;
  setImprovText: (text: string) => void;
  onAction: (action: LocalEditAction) => void;
}) {
  const cell = cellId ? state.cells[cellId] : undefined;
  if (!cell) return null;
  return (
    <div className="action-drawer">
      <h3>Actions for {cellId}</h3>
      <div className="footer-note">{cell.mediaType} · {cell.state} · stress {cell.stress.toFixed(2)}</div>
      <div className="action-row">
        <input
          type="text"
          value={improvText}
          placeholder="commit improv text"
          onChange={(e) => setImprovText(e.target.value)}
        />
        <button
          className="secondary"
          onClick={() => onAction({ type: 'commit_improv', cellId, improvisedContent: improvText || cell.content })}
        >
          Commit improv
        </button>
      </div>
      <div className="action-row">
        <button className="secondary" onClick={() => onAction({ type: 'ghost_cell', cellId })}>Ghost</button>
        <button className="secondary" onClick={() => onAction({ type: 'anchor_cell', cellId })}>Anchor</button>
        <button className="secondary" onClick={() => onAction({ type: 'clone_cell_structured', cellId })}>
          Structured clone
        </button>
      </div>
      <div className="footer-note">Anchored cells resist rule-driven content changes; stress stays visible.</div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(() => createInitialScoreState());
  const [selectedCellId, setSelectedCellId] = useState<string | undefined>(undefined);
  const [improvText, setImprovText] = useState('');
  const [auto, setAuto] = useState(false);

  useAutoAdvance(auto, state, setState);

  const docHeadline = useMemo(() => `Document time t=${state.docTime}`, [state.docTime]);

  const performAction = (action: LocalEditAction) => {
    setState((prev) => applyLocalEdit(prev, action));
  };

  return (
    <div className="app-shell">
      <ControlPanel
        controls={state.globalControls}
        ruleGroups={state.ruleGroups}
        onControlsChange={(controls) => setState((prev) => ({ ...prev, globalControls: controls }))}
        onRuleGroupChange={(group) =>
          setState((prev) => ({ ...prev, ruleGroups: { ...prev.ruleGroups, [group.id]: group } }))
        }
      />
      <div className="score-area">
        <div className="toolbar">
          <div className="toolbar-left">
            <button className="primary" onClick={() => setState((prev) => advanceScoreOneStep(prev))}>
              Step
            </button>
            <button className="secondary" onClick={() => setAuto((v) => !v)}>
              {auto ? 'Stop auto' : 'Auto evolve'}
            </button>
            <div className="badge">{docHeadline}</div>
          </div>
          <div className="badge">Volatility {state.globalControls.volatility.toFixed(2)}</div>
        </div>
        <ScoreGrid state={state} onSelectCell={setSelectedCellId} selectedCellId={selectedCellId} />
        <ActionDrawer
          cellId={selectedCellId}
          state={state}
          improvText={improvText}
          setImprovText={setImprovText}
          onAction={performAction}
        />
      </div>
    </div>
  );
}
