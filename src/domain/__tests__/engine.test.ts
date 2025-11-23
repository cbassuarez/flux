import { describe, expect, it } from 'vitest';
import { advanceScoreOneStep } from '../engine';
import { applyLocalEdit } from '../actions';
import { ScoreState, Cell } from '../flux';

function baseState(overrides?: Partial<ScoreState>): ScoreState {
  const layer = { id: 'layer', name: 'Layer', rows: 3, cols: 3, cellIds: ['c1', 'c2', 'c3'] };
  const cells: Record<string, Cell> = {
    c1: {
      id: 'c1',
      mediaType: 'text',
      content: 'alpha',
      tags: [],
      state: 'active',
      priority: 'primary',
      layerId: 'layer',
      row: 1,
      col: 1,
      stress: 0
    },
    c2: {
      id: 'c2',
      mediaType: 'text',
      content: 'beta',
      tags: [],
      state: 'active',
      priority: 'secondary',
      layerId: 'layer',
      row: 1,
      col: 0,
      stress: 0
    },
    c3: {
      id: 'c3',
      mediaType: 'text',
      content: 'gamma',
      tags: [],
      state: 'active',
      priority: 'secondary',
      layerId: 'layer',
      row: 0,
      col: 1,
      stress: 0
    }
  };
  return {
    docTime: 0,
    layers: { layer },
    cells,
    ruleGroups: {
      growth: { id: 'growth', label: 'Growth', weight: 1, enabled: true },
      erosion: { id: 'erosion', label: 'Erosion', weight: 1, enabled: true },
      mechanical: { id: 'mechanical', label: 'Mechanical', weight: 1, enabled: true },
      echo_improv: { id: 'echo_improv', label: 'Echo Improv', weight: 1, enabled: true }
    },
    globalControls: {
      evolutionRate: 1,
      densityBias: 0.5,
      volatility: 0.2,
      historySurfacing: 0
    },
    ...overrides,
    layers: overrides?.layers ?? { layer },
    cells: overrides?.cells ?? cells,
    ruleGroups: overrides?.ruleGroups ?? {
      growth: { id: 'growth', label: 'Growth', weight: 1, enabled: true },
      erosion: { id: 'erosion', label: 'Erosion', weight: 1, enabled: true },
      mechanical: { id: 'mechanical', label: 'Mechanical', weight: 1, enabled: true },
      echo_improv: { id: 'echo_improv', label: 'Echo Improv', weight: 1, enabled: true }
    },
    globalControls: overrides?.globalControls ?? {
      evolutionRate: 1,
      densityBias: 0.5,
      volatility: 0.2,
      historySurfacing: 0
    }
  };
}

describe('advanceScoreOneStep', () => {
  it('adds growth when density bias is high', () => {
    const state = baseState({
      globalControls: { evolutionRate: 1, densityBias: 1, volatility: 0.2, historySurfacing: 0 },
      layers: { layer: { id: 'layer', name: 'Layer', rows: 2, cols: 2, cellIds: ['c1'] } },
      cells: {
        c1: {
          id: 'c1',
          mediaType: 'text',
          content: 'seed',
          tags: [],
          state: 'active',
          priority: 'primary',
          layerId: 'layer',
          row: 0,
          col: 0,
          stress: 0
        }
      }
    });
    const next = advanceScoreOneStep(state);
    expect(Object.keys(next.cells).length).toBeGreaterThan(Object.keys(state.cells).length);
  });

  it('ghosts dense regions when erosion dominates', () => {
    const denseLayer = { id: 'layer', name: 'Layer', rows: 3, cols: 3, cellIds: ['c1', 'c2', 'c3', 'c4'] };
    const state = baseState({
      layers: { layer: denseLayer },
      cells: {
        c1: { id: 'c1', mediaType: 'text', content: 'x', tags: [], state: 'active', priority: 'primary', layerId: 'layer', row: 1, col: 1, stress: 0 },
        c2: { id: 'c2', mediaType: 'text', content: 'x', tags: [], state: 'active', priority: 'secondary', layerId: 'layer', row: 1, col: 0, stress: 0 },
        c3: { id: 'c3', mediaType: 'text', content: 'x', tags: [], state: 'active', priority: 'secondary', layerId: 'layer', row: 0, col: 1, stress: 0 },
        c4: { id: 'c4', mediaType: 'text', content: 'x', tags: [], state: 'active', priority: 'secondary', layerId: 'layer', row: 2, col: 1, stress: 0 }
      },
      globalControls: { evolutionRate: 1, densityBias: 0, volatility: 0.1, historySurfacing: 0 },
      ruleGroups: {
        growth: { id: 'growth', label: 'Growth', weight: 0, enabled: false },
        erosion: { id: 'erosion', label: 'Erosion', weight: 1, enabled: true },
        mechanical: { id: 'mechanical', label: 'Mechanical', weight: 0, enabled: false },
        echo_improv: { id: 'echo_improv', label: 'Echo Improv', weight: 0, enabled: false }
      }
    });
    const next = advanceScoreOneStep(state);
    expect(next.cells.c1.state).toBe('ghost');
  });

  it('raises stress more when volatility is high and mutations occur', () => {
    const base = baseState({
      globalControls: { evolutionRate: 1, densityBias: 1, volatility: 0, historySurfacing: 0 },
      layers: { layer: { id: 'layer', name: 'Layer', rows: 2, cols: 2, cellIds: ['c1'] } },
      cells: {
        c1: {
          id: 'c1',
          mediaType: 'text',
          content: 'seed text for volatility',
          tags: ['mechanical'],
          state: 'active',
          priority: 'primary',
          layerId: 'layer',
          row: 0,
          col: 0,
          stress: 0
        }
      }
    });

    const lowVol = advanceScoreOneStep(base);
    const highVol = advanceScoreOneStep({ ...base, globalControls: { ...base.globalControls, volatility: 1 } });

    expect(highVol.cells.c1.stress).toBeGreaterThan(lowVol.cells.c1.stress);
  });
});

describe('applyLocalEdit', () => {
  it('commits improv and tags the cell', () => {
    const state = baseState({});
    const next = applyLocalEdit(state, { type: 'commit_improv', cellId: 'c1', improvisedContent: 'new idea' });
    expect(next.cells.c1.content).toContain('new idea');
    expect(next.cells.c1.tags).toContain('improv_committed');
  });

  it('ghosts without removing membership', () => {
    const state = baseState({});
    const next = applyLocalEdit(state, { type: 'ghost_cell', cellId: 'c2' });
    expect(next.cells.c2.state).toBe('ghost');
    expect(next.layers.layer.cellIds).toContain('c2');
  });

  it('anchors a cell and preserves content through evolution', () => {
    const state = baseState({});
    const anchored = applyLocalEdit(state, { type: 'anchor_cell', cellId: 'c1' });
    const advanced = advanceScoreOneStep(anchored);
    expect(advanced.cells.c1.content).toBe(state.cells.c1.content);
  });

  it('clones into nearby empty slots with a hard cap', () => {
    const layer = { id: 'layer', name: 'Layer', rows: 2, cols: 3, cellIds: ['c1'] };
    const state = baseState({
      layers: { layer },
      cells: {
        c1: {
          id: 'c1',
          mediaType: 'text',
          content: 'seed',
          tags: [],
          state: 'active',
          priority: 'primary',
          layerId: 'layer',
          row: 0,
          col: 1,
          stress: 0
        }
      }
    });
    const next = applyLocalEdit(state, { type: 'clone_cell_structured', cellId: 'c1' });
    const clones = Object.keys(next.cells).filter((id) => id !== 'c1');
    expect(clones.length).toBeLessThanOrEqual(3);
    clones.forEach((id) => {
      const cell = next.cells[id];
      expect(cell.row).toBeGreaterThanOrEqual(0);
      expect(cell.col).toBeGreaterThanOrEqual(0);
      expect(cell.row).toBeLessThan(layer.rows);
      expect(cell.col).toBeLessThan(layer.cols);
    });
  });
});
