import { Cell, CellId, GlobalFieldControls, Layer, RuleGroupState, ScoreState } from './flux';

function buildRuleGroups(): Record<RuleGroupState['id'], RuleGroupState> {
  return {
    growth: { id: 'growth', label: 'Growth', weight: 0.7, enabled: true },
    erosion: { id: 'erosion', label: 'Erosion', weight: 0.5, enabled: true },
    mechanical: { id: 'mechanical', label: 'Mechanical', weight: 0.4, enabled: true },
    echo_improv: { id: 'echo_improv', label: 'Echo Improv', weight: 0.6, enabled: true }
  };
}

function buildGlobalControls(): GlobalFieldControls {
  return {
    evolutionRate: 1,
    densityBias: 0.5,
    volatility: 0.35,
    historySurfacing: 0.25
  };
}

function createLayer(id: string, name: string, rows: number, cols: number): Layer {
  return { id, name, rows, cols, cellIds: [] };
}

function addCell(
  cells: Record<CellId, Cell>,
  layers: Record<string, Layer>,
  cell: Cell
): void {
  cells[cell.id] = cell;
  layers[cell.layerId].cellIds.push(cell.id);
}

function seedCells(
  cells: Record<CellId, Cell>,
  layers: Record<string, Layer>
): void {
  const initialCells: Cell[] = [
    {
      id: 'a1',
      mediaType: 'text',
      content: 'trace the skyline with bowed glass',
      tags: ['improv_prompt'],
      state: 'active',
      priority: 'primary',
      layerId: 'layerA',
      row: 0,
      col: 0,
      stress: 0
    },
    {
      id: 'a2',
      mediaType: 'notation',
      content: '♩ ♪ ♩',
      tags: ['mechanical'],
      state: 'active',
      priority: 'secondary',
      layerId: 'layerA',
      row: 0,
      col: 1,
      stress: 0
    },
    {
      id: 'a3',
      mediaType: 'icon',
      content: '✶',
      tags: ['noise'],
      state: 'ghost',
      priority: 'tertiary',
      layerId: 'layerA',
      row: 1,
      col: 0,
      stress: 0.2
    },
    {
      id: 'a4',
      mediaType: 'text',
      content: 'slow tremolo under breath',
      tags: ['improv_source'],
      state: 'anchored',
      priority: 'primary',
      layerId: 'layerA',
      row: 1,
      col: 1,
      stress: 0
    },
    {
      id: 'b1',
      mediaType: 'image',
      content: 'image-placeholder',
      tags: ['texture'],
      state: 'active',
      priority: 'secondary',
      layerId: 'layerB',
      row: 0,
      col: 0,
      stress: 0.1
    },
    {
      id: 'b2',
      mediaType: 'video',
      content: 'video-placeholder',
      tags: ['pulse'],
      state: 'active',
      priority: 'secondary',
      layerId: 'layerB',
      row: 0,
      col: 1,
      stress: 0.1
    },
    {
      id: 'b3',
      mediaType: 'text',
      content: 'fall in and out of sync every 7 beats',
      tags: ['improv_prompt', 'mechanical'],
      state: 'active',
      priority: 'primary',
      layerId: 'layerB',
      row: 1,
      col: 0,
      stress: 0
    },
    {
      id: 'b4',
      mediaType: 'notation',
      content: '𝅘𝅥𝅘𝅥𝅘𝅥𝅮',
      tags: ['echo'],
      state: 'ghost',
      priority: 'tertiary',
      layerId: 'layerB',
      row: 1,
      col: 1,
      stress: 0.3
    }
  ];

  initialCells.forEach((cell) => addCell(cells, layers, cell));
}

export function createInitialScoreState(): ScoreState {
  const layers: Record<string, Layer> = {
    layerA: createLayer('layerA', 'Layer A', 3, 3),
    layerB: createLayer('layerB', 'Layer B', 3, 3)
  };

  const cells: Record<CellId, Cell> = {};
  seedCells(cells, layers);

  return {
    docTime: 0,
    layers,
    cells,
    ruleGroups: buildRuleGroups(),
    globalControls: buildGlobalControls()
  };
}
