import React from 'react';
import { ScoreState, Cell } from '../domain/flux';

interface ScoreGridProps {
  state: ScoreState;
  onSelectCell: (cellId: string) => void;
  selectedCellId?: string;
}

function cellColor(cell: Cell): string {
  if (cell.state === 'anchored') return '#224';
  if (cell.state === 'ghost') return '#eee';
  return '#fff';
}

function stressOutline(stress: number): string {
  if (stress <= 0) return '1px solid #d9d9d9';
  if (stress <= 1) return '2px solid #f0b429';
  return '2px solid #d7263d';
}

function stateBadge(cell: Cell): string {
  switch (cell.state) {
    case 'anchored':
      return 'A';
    case 'ghost':
      return 'G';
    case 'archived':
      return 'R';
    default:
      return '';
  }
}

function mediaGlyph(mediaType: Cell['mediaType']): string {
  switch (mediaType) {
    case 'text':
      return '✎';
    case 'notation':
      return '♪';
    case 'icon':
      return '◈';
    case 'image':
      return '▣';
    case 'video':
      return '▻';
    default:
      return '';
  }
}

export function ScoreGrid({ state, onSelectCell, selectedCellId }: ScoreGridProps) {
  return (
    <div className="score-layout">
      {Object.values(state.layers).map((layer) => (
        <div key={layer.id} className="layer-panel">
          <div className="layer-header">
            <h3>{layer.name}</h3>
            <span className="layer-meta">
              {layer.rows}x{layer.cols} grid
            </span>
          </div>
          <div
            className="layer-grid"
            style={{
              gridTemplateRows: `repeat(${layer.rows}, 1fr)`,
              gridTemplateColumns: `repeat(${layer.cols}, 1fr)`
            }}
          >
            {Array.from({ length: layer.rows * layer.cols }).map((_, index) => {
              const row = Math.floor(index / layer.cols);
              const col = index % layer.cols;
              const cellId = layer.cellIds.find((id) => {
                const cell = state.cells[id];
                return cell.row === row && cell.col === col;
              });
              if (!cellId) {
                return <div key={`${layer.id}-${index}`} className="cell empty" />;
              }
              const cell = state.cells[cellId];
              const isSelected = selectedCellId === cellId;
              return (
                <button
                  key={cell.id}
                  className={`cell ${isSelected ? 'selected' : ''}`}
                  style={{ background: cellColor(cell), border: stressOutline(cell.stress) }}
                  onClick={() => onSelectCell(cell.id)}
                  aria-label={`cell-${cell.id}`}
                >
                  <div className="cell-top">
                    <span className="media-type">{mediaGlyph(cell.mediaType)}</span>
                    {stateBadge(cell) && <span className="badge">{stateBadge(cell)}</span>}
                    {cell.tags.includes('improv_echo') && <span className="badge ghost">echo</span>}
                  </div>
                  <div className="cell-content">{cell.content}</div>
                  <div className="cell-meta">
                    <span className={`priority ${cell.priority}`}>{cell.priority}</span>
                    <span className="stress">stress {cell.stress.toFixed(2)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
