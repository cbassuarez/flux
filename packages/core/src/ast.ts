// Flux AST definitions for v0.1.0

export type FluxType = "int" | "float" | "bool" | "string" | "enum";

export interface FluxParam {
  name: string;
  type: FluxType;
  min?: number | string;
  max?: number | string;
  initial: number | string | boolean;
}

export interface FluxState {
  params: FluxParam[];
}

export interface FluxMeta {
  title?: string;
  author?: string;
  version: string; // language version (semver), e.g. "0.1.0"
  [key: string]: string | undefined;
}

export interface PageSize {
  width: number;
  height: number;
  units: string;
}

export interface PageConfig {
  size: PageSize;
}

export type Topology = "grid" | "linear" | "graph" | "spatial";

export type PayloadKind =
  | "none"
  | "phrase"
  | "audio_clip"
  | "image"
  | "video";

export interface BasePayload {
  kind: PayloadKind | string; // string allows user-defined kinds
}

export interface PhrasePayload extends BasePayload {
  kind: "phrase";
  instrument?: string;
  pitches: string[];
  durations: number[];
}

export interface AudioClipPayload extends BasePayload {
  kind: "audio_clip";
  start: number;
  duration: number;
  gain?: number;
}

export interface ImagePayload extends BasePayload {
  kind: "image";
  crop?: { x: number; y: number; w: number; h: number };
  opacity?: number;
}

export interface VideoPayload extends BasePayload {
  kind: "video";
  start?: number;
  end?: number;
  loop?: boolean;
}

export type FluxPayload =
  | BasePayload
  | PhrasePayload
  | AudioClipPayload
  | ImagePayload
  | VideoPayload
  | Record<string, any>;

export interface FluxCell {
  id: string;
  tags: string[];
  content?: string;
  mediaId?: string;
  payload?: FluxPayload;

  // standard numeric fields
  dynamic?: number;
  density?: number;
  salience?: number;

  // user-defined numeric fields
  numericFields?: Record<string, number>;
}

export interface GridSize {
  rows?: number;
  cols?: number;
}

export interface FluxGrid {
  name: string;
  topology: Topology;
  page?: number;
  size?: GridSize;
  cells: FluxCell[];
}

// Events and runtime configuration

export type CanonicalEventType = "transport" | "input" | "sensor";

export interface FluxEvent {
  type: string; // canonical or user-defined
  source?: string;
  location?: any;
  payload?: any;
  timestamp: number;
}

export type EventsApplyPolicy =
    | "immediate"
    | "deferred"
    | "cellImmediateParamsDeferred";

export type DocstepAdvanceKind = "timer" | "transport" | "ruleRequest";

export type TimerUnit =
    | "s"
    | "sec"
    | "secs"
    | "second"
    | "seconds"
    | "ms"
    | "millisecond"
    | "milliseconds"
    | "m"
    | "min"
    | "mins"
    | "minute"
    | "minutes"
    | "h"
    | "hr"
    | "hrs"
    | "hour"
    | "hours"
    | "bar"
    | "bars"
    | "measure"
    | "measures"
    | "beat"
    | "beats"
    | "sub"
    | "subs"
    | "subdivision"
    | "subdivisions"
    | "tick"
    | "ticks";

export interface DocstepAdvanceTimer {
    kind: "timer";
    amount: number;
    unit: TimerUnit;
}

export interface DocstepAdvanceTransport {
  kind: "transport";
  eventName: string;
}

export interface DocstepAdvanceRuleRequest {
  kind: "ruleRequest";
  name: string;
}

export type DocstepAdvanceSpec =
  | DocstepAdvanceTimer
  | DocstepAdvanceTransport
  | DocstepAdvanceRuleRequest;

export interface FluxRuntimeConfig {
  eventsApply?: EventsApplyPolicy;
  docstepAdvance?: DocstepAdvanceSpec[];
}

// Materials (score / midi / video descriptors)

export interface MaterialScore {
    text?: string;
    staff?: string;
    clef?: string;
}

export interface MaterialMidi {
    channel?: number;
    pitch?: number;
    velocity?: number;
    durationSeconds?: number;
}

export interface MaterialVideo {
    clip: string;
    inSeconds?: number;
    outSeconds?: number;
    layer?: string;
}

export interface Material {
    name: string;
    tags: string[];
    label?: string;
    description?: string;
    color?: string;
    score?: MaterialScore;
    midi?: MaterialMidi;
    video?: MaterialVideo;
}

export interface MaterialsBlock {
    materials: Material[];
}

// Assets (v0.2)

export type AssetStrategy = "weighted" | "uniform";

export interface AssetDefinition {
  name: string;
  kind: string;
  path: string;
  tags: string[];
  weight?: number;
  meta?: Record<string, FluxValueLiteral>;
}

export interface AssetBank {
  name: string;
  kind: string;
  root: string;
  include: string;
  tags: string[];
  strategy?: AssetStrategy;
}

export interface AssetsBlock {
  assets: AssetDefinition[];
  banks: AssetBank[];
}

// Rule calculus AST

export type RuleMode = "docstep" | "event" | "timer";

export interface RuleScope {
  grid?: string; // grid name; undefined means global
}

export type BinaryOp =
    | "=="
    | "!="
    | "==="
    | "!=="
    | "<"
    | "<="
    | ">"
    | ">="
    | "+"
    | "-"
    | "*"
    | "/"
    | "and"
    | "or";

export type UnaryOp = "-" | "not";

export type FluxLiteralValue = number | string | boolean;

export interface LiteralExpr {
  kind: "Literal";
  value: FluxLiteralValue;
}

export interface ListExpr {
  kind: "ListExpression";
  items: FluxExpr[];
}

export interface IdentifierExpr {
  kind: "Identifier";
  name: string;
}

export interface MemberExpr {
  kind: "MemberExpression";
  object: FluxExpr;
  property: string;
}

export interface CallExpr {
  kind: "CallExpression";
  callee: FluxExpr;
  args: CallArg[];
}

export interface UnaryExpr {
  kind: "UnaryExpression";
  op: UnaryOp;
  argument: FluxExpr;
}

export interface BinaryExpr {
  kind: "BinaryExpression";
  op: BinaryOp;
  left: FluxExpr;
  right: FluxExpr;
}

export interface NeighborsCallExpr {
    kind: "NeighborsCallExpression";
    namespace: "neighbors";
    method: string;
    args: CallArg[];
}

export interface NamedArg {
  kind: "NamedArg";
  name: string;
  value: FluxExpr;
}

export type CallArg = FluxExpr | NamedArg;

export type FluxExpr =
    | LiteralExpr
    | ListExpr
    | IdentifierExpr
    | MemberExpr
    | CallExpr
    | UnaryExpr
    | BinaryExpr
    | NeighborsCallExpr;

// Values for document nodes
export type FluxValueLiteral = FluxLiteralValue | FluxValueLiteral[];

export interface LiteralValue {
  kind: "LiteralValue";
  value: FluxValueLiteral;
}

export interface DynamicValue {
  kind: "DynamicValue";
  expr: FluxExpr;
}

export type NodePropValue = LiteralValue | DynamicValue;

// Statements

export interface AssignmentStmt {
  kind: "AssignmentStatement";
  target: FluxExpr; // usually MemberExpression or Identifier
  value: FluxExpr;
}

export interface LetStmt {
  kind: "LetStatement";
  name: string;
  value: FluxExpr;
}

export interface AdvanceDocstepStmt {
  kind: "AdvanceDocstepStatement";
}

export interface ExpressionStmt {
  kind: "ExpressionStatement";
  expr: FluxExpr;
}

export type FluxStmt =
  | AssignmentStmt
  | LetStmt
  | AdvanceDocstepStmt
  | ExpressionStmt;

// Rules

export interface RuleBranch {
    condition: FluxExpr;
    thenBranch: FluxStmt[];
}

export interface FluxRule {
    name: string;
    mode: RuleMode;
    scope?: RuleScope;
    onEventType?: string;

    // v0.1 multi-branch structure
    branches: RuleBranch[];

    // Convenience mirrors of the first branch for callers that still expect single-branch rules.
    condition: FluxExpr;
    thenBranch: FluxStmt[];

    elseBranch?: FluxStmt[];
}

// Document body (v0.2)

export type RefreshPolicyKind = "onLoad" | "onDocstep" | "never" | "every";

export interface RefreshPolicyBase {
  kind: "onLoad" | "onDocstep" | "never";
}

export interface RefreshEveryPolicy {
  kind: "every";
  amount: number;
  unit: TimerUnit;
}

export type RefreshPolicy = RefreshPolicyBase | RefreshEveryPolicy;

export type NodeKind =
  | "page"
  | "section"
  | "row"
  | "column"
  | "spacer"
  | "text"
  | "image"
  | "figure"
  | "table"
  | "grid"
  | "slot";

export interface DocumentNode {
  id: string;
  kind: NodeKind | string;
  props: Record<string, NodePropValue>;
  children: DocumentNode[];
  refresh?: RefreshPolicy;
}

export interface BodyBlock {
  nodes: DocumentNode[];
}

// Document

export interface FluxDocument {
  meta: FluxMeta;
  state: FluxState;
  pageConfig?: PageConfig;
  grids: FluxGrid[];
  rules: FluxRule[];
  runtime?: FluxRuntimeConfig;
  materials?: MaterialsBlock | null;
  assets?: AssetsBlock | null;
  body?: BodyBlock | null;
}
