import { Cell, CellId, Layer, RuleGroupState, ScoreState } from './flux';

export function positionKey(cell: Pick<Cell, 'row' | 'col'>): string {
  return `${cell.row},${cell.col}`;
}

export function getNeighborCoords(row: number, col: number): { row: number; col: number }[] {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 }
  ];
}

function cloneState(prev: ScoreState): ScoreState {
  return {
    ...prev,
    layers: Object.fromEntries(
      Object.entries(prev.layers).map(([id, layer]) => [id, { ...layer, cellIds: [...layer.cellIds] }])
    ),
    cells: Object.fromEntries(
      Object.entries(prev.cells).map(([id, cell]) => [id, { ...cell, tags: [...cell.tags] }])
    ),
    ruleGroups: Object.fromEntries(
      Object.entries(prev.ruleGroups).map(([id, group]) => [id, { ...group } as RuleGroupState])
    ) as Record<keyof ScoreState['ruleGroups'], RuleGroupState>
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) % 1000000007;
  }
  return hash;
}

function pseudoRandom(seed: string): number {
  return (hashString(seed) % 10000) / 10000;
}

function layerPositionMap(cells: Record<CellId, Cell>): Record<string, Map<string, CellId>> {
  const map: Record<string, Map<string, CellId>> = {};
  Object.values(cells).forEach((cell) => {
    if (!map[cell.layerId]) map[cell.layerId] = new Map();
    map[cell.layerId].set(positionKey(cell), cell.id);
  });
  return map;
}

function findEmptyNeighbor(
  layer: Layer,
  occupied: Map<string, CellId>,
  cell: Cell
): { row: number; col: number } | undefined {
  return getNeighborCoords(cell.row, cell.col).find(({ row, col }) => {
    const key = `${row},${col}`;
    return row >= 0 && row < layer.rows && col >= 0 && col < layer.cols && !occupied.has(key);
  });
}

function applyGrowth(
  state: ScoreState,
  occupied: Record<string, Map<string, CellId>>,
  mutated: Set<CellId>
): void {
  const group = state.ruleGroups.growth;
  if (!group?.enabled || group.weight <= 0) return;
  const { densityBias } = state.globalControls;
  let cloneCounter = 0;

  Object.values(state.cells).forEach((cell) => {
    if (cell.state !== 'active' || cell.state === 'anchored') return;
    const layer = state.layers[cell.layerId];
    const layerOccupied = occupied[cell.layerId];
    if (!layerOccupied) return;

    const chance = densityBias * group.weight;
    const seed = `${state.docTime}-${cell.id}-growth`;
    if (pseudoRandom(seed) < chance) {
      const empty = findEmptyNeighbor(layer, layerOccupied, cell);
      if (empty) {
        const cloneId = `${cell.id}-g${state.docTime}-${cloneCounter++}`;
        const clone: Cell = {
          ...cell,
          id: cloneId,
          row: empty.row,
          col: empty.col,
          tags: [...cell.tags, 'growth_clone'],
          stress: cell.stress * 0.5,
          state: 'active'
        };
        state.cells[cloneId] = clone;
        layer.cellIds.push(cloneId);
        layerOccupied.set(positionKey(clone), cloneId);
        mutated.add(cloneId);
      }
    }
  });
}

function applyErosion(
  state: ScoreState,
  occupied: Record<string, Map<string, CellId>>,
  mutated: Set<CellId>
): void {
  const group = state.ruleGroups.erosion;
  if (!group?.enabled || group.weight <= 0) return;
  const { densityBias } = state.globalControls;

  Object.values(state.cells).forEach((cell) => {
    if (cell.state !== 'active' || cell.state === 'anchored') return;
    const layer = state.layers[cell.layerId];
    const layerOccupied = occupied[cell.layerId];
    if (!layerOccupied) return;

    const neighbors = getNeighborCoords(cell.row, cell.col).filter(({ row, col }) =>
      layerOccupied.has(`${row},${col}`)
    );
    const localDensity = neighbors.length / 4;
    const chance = (1 - densityBias) * group.weight;
    const seed = `${state.docTime}-${cell.id}-erosion`;
    if (localDensity > 0.5 && pseudoRandom(seed) < chance) {
      cell.state = 'ghost';
      cell.priority = 'tertiary';
      mutated.add(cell.id);
    }
  });
}

function applyMechanical(state: ScoreState, mutated: Set<CellId>): void {
  const group = state.ruleGroups.mechanical;
  if (!group?.enabled || group.weight <= 0) return;

  Object.values(state.cells).forEach((cell, idx) => {
    if (cell.state === 'anchored') return;
    if (!(cell.tags.includes('mechanical') || cell.mediaType === 'notation')) return;
    const seed = `${state.docTime}-${cell.id}-mechanical`;
    if (pseudoRandom(seed) < group.weight * 0.8) {
      const motif = ['▮▯', '▱▰', '▬ ▬', '• •'][idx % 4];
      cell.content = `${motif} ${cell.content.split(' ')[0] || cell.content}`.slice(0, 30);
      mutated.add(cell.id);
    }
  });
}

function applyEchoImprov(
  state: ScoreState,
  occupied: Record<string, Map<string, CellId>>,
  mutated: Set<CellId>
): void {
  const group = state.ruleGroups.echo_improv;
  if (!group?.enabled || group.weight <= 0) return;

  let echoCounter = 0;
  Object.values(state.cells).forEach((cell) => {
    if (!cell.tags.includes('improv_source') || cell.state === 'anchored') return;
    const layer = state.layers[cell.layerId];
    const layerOccupied = occupied[cell.layerId];
    if (!layerOccupied) return;

    const seed = `${state.docTime}-${cell.id}-echo`;
    if (pseudoRandom(seed) < group.weight * 0.6) {
      const empty = findEmptyNeighbor(layer, layerOccupied, cell);
      if (empty) {
        const cloneId = `${cell.id}-e${state.docTime}-${echoCounter++}`;
        const clone: Cell = {
          ...cell,
          id: cloneId,
          row: empty.row,
          col: empty.col,
          tags: [...cell.tags, 'improv_echo'],
          state: 'active',
          priority: 'secondary',
          stress: cell.stress * 0.4,
          content: `${cell.content} (echo)`
        };
        state.cells[cloneId] = clone;
        layer.cellIds.push(cloneId);
        layerOccupied.set(positionKey(clone), cloneId);
        mutated.add(cloneId);
      }
    }
  });
}

function resurfaceHistory(state: ScoreState, mutated: Set<CellId>): void {
  const { historySurfacing } = state.globalControls;
  if (historySurfacing <= 0) return;
  Object.values(state.cells).forEach((cell) => {
    if (cell.state === 'ghost' && pseudoRandom(`${state.docTime}-${cell.id}-history`) < historySurfacing * 0.3) {
      cell.state = 'active';
      cell.priority = 'secondary';
      mutated.add(cell.id);
    }
  });
}

function computeStress(state: ScoreState, mutated: Set<CellId>): void {
  const { volatility } = state.globalControls;
  const occupied = layerPositionMap(state.cells);
  Object.values(state.cells).forEach((cell) => {
    const layer = state.layers[cell.layerId];
    const layerOccupied = occupied[cell.layerId];
    const neighbors = getNeighborCoords(cell.row, cell.col).filter(
      ({ row, col }) => row >= 0 && row < layer.rows && col >= 0 && col < layer.cols
    );
    const activeNeighbors = neighbors.filter(({ row, col }) => {
      const neighborId = layerOccupied?.get(`${row},${col}`);
      if (!neighborId) return false;
      const neighbor = state.cells[neighborId];
      return neighbor.state === 'active' || neighbor.state === 'anchored';
    }).length;
    const densityRatio = (activeNeighbors + (cell.state === 'active' || cell.state === 'anchored' ? 1 : 0)) /
      (neighbors.length + 1);
    const densityStress = Math.max(0, densityRatio - 0.5);
    const lengthStress = cell.content.length > 40 ? 0.2 : 0;
    const volatilityStress = mutated.has(cell.id) ? volatility * 0.6 : volatility * 0.1;
    const decayed = cell.stress * 0.6;
    cell.stress = Math.min(2.5, decayed + densityStress + lengthStress + volatilityStress);
  });
}

export function advanceScoreOneStep(prev: ScoreState): ScoreState {
  const next = cloneState(prev);
  next.docTime = prev.docTime + 1;

  const occupied = layerPositionMap(next.cells);
  const mutated = new Set<CellId>();

  applyGrowth(next, occupied, mutated);
  applyErosion(next, occupied, mutated);
  applyMechanical(next, mutated);
  applyEchoImprov(next, occupied, mutated);
  resurfaceHistory(next, mutated);
  computeStress(next, mutated);

  return next;
}
