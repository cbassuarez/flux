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
    version: string;
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
export type PayloadKind = "none" | "phrase" | "audio_clip" | "image" | "video";
export interface BasePayload {
    kind: PayloadKind | string;
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
    crop?: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    opacity?: number;
}
export interface VideoPayload extends BasePayload {
    kind: "video";
    start?: number;
    end?: number;
    loop?: boolean;
}
export type FluxPayload = BasePayload | PhrasePayload | AudioClipPayload | ImagePayload | VideoPayload | Record<string, any>;
export interface FluxCell {
    id: string;
    tags: string[];
    content?: string;
    mediaId?: string;
    payload?: FluxPayload;
    dynamic?: number;
    density?: number;
    salience?: number;
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
export type CanonicalEventType = "transport" | "input" | "sensor";
export interface FluxEvent {
    type: string;
    source?: string;
    location?: any;
    payload?: any;
    timestamp: number;
}
export type EventsApplyPolicy = "immediate" | "deferred" | "cellImmediateParamsDeferred";
export type DocstepAdvanceKind = "timer" | "transport" | "ruleRequest";
export type TimerUnit = "s" | "sec" | "secs" | "second" | "seconds" | "ms" | "millisecond" | "milliseconds" | "m" | "min" | "mins" | "minute" | "minutes" | "h" | "hr" | "hrs" | "hour" | "hours" | "bar" | "bars" | "measure" | "measures" | "beat" | "beats" | "sub" | "subs" | "subdivision" | "subdivisions" | "tick" | "ticks";
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
export type DocstepAdvanceSpec = DocstepAdvanceTimer | DocstepAdvanceTransport | DocstepAdvanceRuleRequest;
export interface FluxRuntimeConfig {
    eventsApply?: EventsApplyPolicy;
    docstepAdvance?: DocstepAdvanceSpec[];
}
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
export type RuleMode = "docstep" | "event" | "timer";
export interface RuleScope {
    grid?: string;
}
export type BinaryOp = "==" | "!=" | "===" | "!==" | "<" | "<=" | ">" | ">=" | "+" | "-" | "*" | "/" | "and" | "or";
export type UnaryOp = "-" | "not";
export type FluxLiteralValue = number | string | boolean;
export interface ExprBase {
    loc?: SourceSpan;
}
export interface LiteralExpr extends ExprBase {
    kind: "Literal";
    value: FluxLiteralValue;
}
export interface ListExpr extends ExprBase {
    kind: "ListExpression";
    items: FluxExpr[];
}
export interface IdentifierExpr extends ExprBase {
    kind: "Identifier";
    name: string;
}
export interface MemberExpr extends ExprBase {
    kind: "MemberExpression";
    object: FluxExpr;
    property: string;
}
export interface CallExpr extends ExprBase {
    kind: "CallExpression";
    callee: FluxExpr;
    args: CallArg[];
}
export interface UnaryExpr extends ExprBase {
    kind: "UnaryExpression";
    op: UnaryOp;
    argument: FluxExpr;
}
export interface BinaryExpr extends ExprBase {
    kind: "BinaryExpression";
    op: BinaryOp;
    left: FluxExpr;
    right: FluxExpr;
}
export interface NeighborsCallExpr extends ExprBase {
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
export type FluxExpr = LiteralExpr | ListExpr | IdentifierExpr | MemberExpr | CallExpr | UnaryExpr | BinaryExpr | NeighborsCallExpr;
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
export interface AssignmentStmt {
    kind: "AssignmentStatement";
    target: FluxExpr;
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
export type FluxStmt = AssignmentStmt | LetStmt | AdvanceDocstepStmt | ExpressionStmt;
export interface RuleBranch {
    condition: FluxExpr;
    thenBranch: FluxStmt[];
}
export interface FluxRule {
    name: string;
    mode: RuleMode;
    scope?: RuleScope;
    onEventType?: string;
    branches: RuleBranch[];
    condition: FluxExpr;
    thenBranch: FluxStmt[];
    elseBranch?: FluxStmt[];
}
export type RefreshPolicyKind = "never" | "docstep" | "every" | "at" | "atEach" | "poisson" | "chance";
export interface RefreshNeverPolicy {
    kind: "never";
}
export interface RefreshDocstepPolicy {
    kind: "docstep";
}
export interface RefreshEveryPolicy {
    kind: "every";
    intervalSec: number;
    phaseSec: number;
}
export interface RefreshAtPolicy {
    kind: "at";
    timeSec: number;
}
export interface RefreshAtEachPolicy {
    kind: "atEach";
    timesSec: number[];
}
export interface RefreshPoissonPolicy {
    kind: "poisson";
    ratePerSec: number;
}
export type RefreshChanceEvery = {
    kind: "docstep";
} | {
    kind: "time";
    intervalSec: number;
};
export interface RefreshChancePolicy {
    kind: "chance";
    p: number;
    every: RefreshChanceEvery;
}
export type RefreshPolicy = RefreshNeverPolicy | RefreshDocstepPolicy | RefreshEveryPolicy | RefreshAtPolicy | RefreshAtEachPolicy | RefreshPoissonPolicy | RefreshChancePolicy;
export type TransitionEase = "inOut" | "linear" | "in" | "out";
export type TransitionDirection = "left" | "right" | "up" | "down";
export type TransitionSpec = {
    kind: "none";
} | {
    kind: "appear";
} | {
    kind: "fade";
    durationMs?: number;
    ease?: TransitionEase;
} | {
    kind: "wipe";
    durationMs?: number;
    ease?: TransitionEase;
    direction?: TransitionDirection;
} | {
    kind: "flash";
    durationMs?: number;
};
export type NodeKind = "page" | "section" | "row" | "column" | "spacer" | "text" | "em" | "strong" | "code" | "smallcaps" | "sub" | "sup" | "mark" | "link" | "quote" | "blockquote" | "codeblock" | "callout" | "image" | "figure" | "table" | "ul" | "ol" | "li" | "hr" | "footnote" | "grid" | "slot" | "inline_slot" | "include";
export interface DocumentNode {
    id: string;
    kind: NodeKind | string;
    props: Record<string, NodePropValue>;
    children: DocumentNode[];
    refresh?: RefreshPolicy;
    transition?: TransitionSpec;
    loc?: SourceSpan;
}
export interface BodyBlock {
    nodes: DocumentNode[];
}
export interface SourceSpan {
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
}
export interface TokensBlock {
    tokens: Record<string, FluxValueLiteral>;
}
export interface StyleDef {
    name: string;
    extends?: string;
    props: Record<string, NodePropValue>;
}
export interface StylesBlock {
    styles: StyleDef[];
}
export interface ThemeBlock {
    name: string;
    tokens?: TokensBlock | null;
    styles?: StylesBlock | null;
}
export interface FluxDocument {
    meta: FluxMeta;
    state: FluxState;
    pageConfig?: PageConfig;
    grids: FluxGrid[];
    rules: FluxRule[];
    runtime?: FluxRuntimeConfig;
    materials?: MaterialsBlock | null;
    assets?: AssetsBlock | null;
    tokens?: TokensBlock | null;
    styles?: StylesBlock | null;
    themes?: ThemeBlock[] | null;
    body?: BodyBlock | null;
}
//# sourceMappingURL=ast.d.ts.map