export type MediaType = 'text' | 'notation' | 'icon' | 'image' | 'video';

export type CellVisualState = 'active' | 'ghost' | 'anchored' | 'archived';

export type CellPriority = 'primary' | 'secondary' | 'tertiary';

export type CellId = string;

export interface Cell {
  id: CellId;
  mediaType: MediaType;
  content: string;
  tags: string[];
  state: CellVisualState;
  priority: CellPriority;
  layerId: string;
  row: number;
  col: number;
  stress: number; // 0 = relaxed, >0 stressed
}

export interface Layer {
  id: string;
  name: string;
  rows: number;
  cols: number;
  cellIds: CellId[];
}

export type RuleGroupId = 'growth' | 'erosion' | 'mechanical' | 'echo_improv';

export interface RuleGroupState {
  id: RuleGroupId;
  label: string;
  weight: number; // 0-1 blending strength
  enabled: boolean;
}

export interface GlobalFieldControls {
  evolutionRate: number; // 0 = frozen, 1 = normal, 2+ = fast
  densityBias: number; // 0 = sparse, 1 = dense
  volatility: number; // 0 = stable, 1 = very volatile
  historySurfacing: number; // 0 = present only, 1 = lots of ghosts resurfacing
}

export interface ScoreState {
  docTime: number;
  layers: Record<string, Layer>;
  cells: Record<CellId, Cell>;
  ruleGroups: Record<RuleGroupId, RuleGroupState>;
  globalControls: GlobalFieldControls;
}
