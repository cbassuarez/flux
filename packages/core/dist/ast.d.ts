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
export interface DocstepAdvanceTimer {
    kind: "timer";
    intervalSeconds: number;
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
export type RuleMode = "docstep" | "event" | "timer";
export interface RuleScope {
    grid?: string;
}
export type BinaryOp = "==" | "!=" | "===" | "!==" | "<" | "<=" | ">" | ">=" | "+" | "-" | "*" | "/" | "and" | "or";
export type UnaryOp = "-" | "not";
export type FluxLiteralValue = number | string | boolean;
export interface LiteralExpr {
    kind: "Literal";
    value: FluxLiteralValue;
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
    args: FluxExpr[];
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
    args: FluxExpr[];
}
export type FluxExpr = LiteralExpr | IdentifierExpr | MemberExpr | CallExpr | UnaryExpr | BinaryExpr | NeighborsCallExpr;
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
export interface FluxRule {
    name: string;
    mode: RuleMode;
    scope?: RuleScope;
    onEventType?: string;
    condition: FluxExpr;
    thenBranch: FluxStmt[];
    elseBranch?: FluxStmt[];
}
export interface FluxDocument {
    meta: FluxMeta;
    state: FluxState;
    pageConfig?: PageConfig;
    grids: FluxGrid[];
    rules: FluxRule[];
    runtime?: FluxRuntimeConfig;
}
//# sourceMappingURL=ast.d.ts.map