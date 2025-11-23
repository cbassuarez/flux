import { ScoreState, CellId, Cell } from './flux';
import { getNeighborCoords, positionKey } from './engine';

export type LocalEditAction =
  | { type: 'commit_improv'; cellId: CellId; improvisedContent: string }
  | { type: 'ghost_cell'; cellId: CellId }
  | { type: 'anchor_cell'; cellId: CellId }
  | { type: 'clone_cell_structured'; cellId: CellId };

function cloneState(state: ScoreState): ScoreState {
  return {
    ...state,
    layers: Object.fromEntries(
      Object.entries(state.layers).map(([id, layer]) => [id, { ...layer, cellIds: [...layer.cellIds] }])
    ),
    cells: Object.fromEntries(Object.entries(state.cells).map(([id, cell]) => [id, { ...cell, tags: [...cell.tags] }]))
  };
}

function truncateContent(content: string): string {
  const limit = 80;
  return content.length > limit ? `${content.slice(0, limit)}…` : content;
}

function findEmptyNeighbors(state: ScoreState, cell: Cell): { row: number; col: number }[] {
  const layer = state.layers[cell.layerId];
  const occupied = new Set(layer.cellIds.map((id) => positionKey(state.cells[id])));
  return getNeighborCoords(cell.row, cell.col)
    .filter(({ row, col }) => row >= 0 && row < layer.rows && col >= 0 && col < layer.cols)
    .filter(({ row, col }) => !occupied.has(positionKey({ row, col } as Cell)));
}

export function applyLocalEdit(state: ScoreState, action: LocalEditAction): ScoreState {
  const next = cloneState(state);
  const target = next.cells[action.cellId];
  if (!target) return next;

  switch (action.type) {
    case 'commit_improv': {
      target.content = truncateContent(action.improvisedContent || target.content);
      if (!target.tags.includes('improv_committed')) {
        target.tags.push('improv_committed');
      }
      target.state = 'active';
      target.priority = 'primary';
      target.stress = Math.min(1.2, target.stress + target.content.length / 120);
      break;
    }
    case 'ghost_cell': {
      target.state = 'ghost';
      target.priority = 'tertiary';
      target.stress = Math.max(0, target.stress - 0.2);
      break;
    }
    case 'anchor_cell': {
      target.state = 'anchored';
      target.priority = 'primary';
      target.stress = 0;
      break;
    }
    case 'clone_cell_structured': {
      const emptyNeighbors = findEmptyNeighbors(next, target).slice(0, 3);
      const layer = next.layers[target.layerId];
      emptyNeighbors.forEach((coord, index) => {
        const cloneId = `${target.id}-c${next.docTime}-${index}`;
        const clone: Cell = {
          ...target,
          id: cloneId,
          row: coord.row,
          col: coord.col,
          state: 'active',
          priority: target.priority,
          stress: target.stress * 0.5,
          tags: [...target.tags, 'structured_clone']
        };
        next.cells[cloneId] = clone;
        layer.cellIds.push(cloneId);
      });
      break;
    }
    default:
      break;
  }

  return next;
}
