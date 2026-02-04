// packages/core/src/checks.ts
import type { DocumentNode, FluxDocument, FluxExpr, FluxRule, FluxStmt, NodePropValue } from "./ast.js";

/**
 * Run basic static checks on a FluxDocument.
 *
 * This is used by the CLI and can also be consumed by editor integrations.
 *
 * @param file - A label for the source (path or "<buffer>").
 * @param doc  - Parsed FluxDocument AST.
 * @returns An array of human-readable diagnostic strings.
 */
export function checkDocument(file: string, doc: FluxDocument): string[] {
    const errors: string[] = [];

    const gridNames = new Set(doc.grids.map((g) => g.name));

    for (const rule of doc.rules ?? []) {
        // grid=foo scope must refer to an existing grid
        if (rule.scope?.grid && !gridNames.has(rule.scope.grid)) {
            errors.push(
                `${file}:0:0: Check error: Rule '${rule.name}' references unknown grid '${rule.scope.grid}'`,
            );
        }

        // Expression-level checks (neighbors.* etc.)
        checkRuleExpressions(file, rule, errors);
    }

    // Runtime timers sanity check
    if (doc.runtime?.docstepAdvance) {
        for (const spec of doc.runtime.docstepAdvance) {
            if (spec.kind === "timer" && spec.amount <= 0) {
                errors.push(
                    `${file}:0:0: Check error: timer(...) amount must be positive (found ${spec.amount})`,
                );
            }
        }
    }

    if (doc.body?.nodes?.length) {
        const labelMap = new Map<string, DocumentNode>();
        const refCalls: { label: string; node: DocumentNode }[] = [];
        const diagnostics: string[] = [];
        const visit = (node: DocumentNode): void => {
            const labelProp = node.props?.label;
            if (labelProp) {
                if (labelProp.kind !== "LiteralValue" || typeof labelProp.value !== "string") {
                    diagnostics.push(
                        `${formatNodeLocation(file, node)}: Check error: label must be a literal string`,
                    );
                } else {
                    const label = labelProp.value;
                    if (labelMap.has(label)) {
                        diagnostics.push(
                            `${formatNodeLocation(file, node)}: Check error: duplicate label '${label}'`,
                        );
                    } else {
                        labelMap.set(label, node);
                    }
                }
            }

            const visibleProp = node.props?.visibleIf;
            if (visibleProp) {
                if (visibleProp.kind === "LiteralValue") {
                    if (typeof visibleProp.value !== "boolean") {
                        diagnostics.push(
                            `${formatNodeLocation(file, node)}: Check error: visibleIf expects a boolean`,
                        );
                    }
                } else {
                    const expr = visibleProp.expr;
                    if (!isBooleanishExpr(expr)) {
                        diagnostics.push(
                            `${formatNodeLocation(file, node)}: Check error: visibleIf expects a boolean-ish expression`,
                        );
                    }
                    if (usesDynamicTime(expr)) {
                        diagnostics.push(
                            `${formatNodeLocation(file, node)}: Check error: visibleIf cannot depend on time/docstep or random helpers`,
                        );
                    }
                }
            }

            for (const prop of Object.values(node.props ?? {})) {
                collectRefCalls(prop, node, refCalls, diagnostics, file);
            }

            for (const child of node.children ?? []) {
                visit(child);
            }
        };

        for (const node of doc.body.nodes) {
            visit(node);
        }

        for (const ref of refCalls) {
            if (!labelMap.has(ref.label)) {
                diagnostics.push(
                    `${formatNodeLocation(file, ref.node)}: Check error: ref('${ref.label}') target not found`,
                );
            }
        }

        errors.push(...diagnostics);
    }

    return errors;
}

function formatNodeLocation(file: string, node: DocumentNode): string {
    const loc = node.loc;
    if (loc?.line != null && loc?.column != null) {
        return `${file}:${loc.line}:${loc.column}`;
    }
    return `${file}:0:0`;
}

function checkRuleExpressions(
    file: string,
    rule: FluxRule,
    errors: string[],
): void {
    if (rule.condition) {
        checkExpr(rule.condition, file, errors);
    }

    for (const stmt of rule.thenBranch ?? []) {
        checkStmt(stmt, file, errors);
    }

    if (rule.elseBranch) {
        for (const stmt of rule.elseBranch) {
            checkStmt(stmt, file, errors);
        }
    }

    // v0.1: some rules may have desugared branches (else-when chains)
    const anyRule = rule as any;
    if (Array.isArray(anyRule.branches)) {
        for (const branch of anyRule.branches as {
            condition: FluxExpr;
            thenBranch: FluxStmt[];
        }[]) {
            checkExpr(branch.condition, file, errors);
            for (const stmt of branch.thenBranch) {
                checkStmt(stmt, file, errors);
            }
        }
    }
}

function checkExpr(
    expr: FluxExpr,
    file: string,
    errors: string[],
): void {
    switch (expr.kind) {
        case "NeighborsCallExpression":
            if (expr.method !== "all" && expr.method !== "orth") {
                errors.push(
                    `${file}:0:0: Check error: Unsupported neighbors method '${expr.method}'`,
                );
            }
            for (const arg of expr.args) {
                if (arg.kind === "NamedArg") {
                    checkExpr(arg.value, file, errors);
                } else {
                    checkExpr(arg, file, errors);
                }
            }
            break;

        case "BinaryExpression":
            checkExpr(expr.left, file, errors);
            checkExpr(expr.right, file, errors);
            break;

        case "UnaryExpression":
            checkExpr(expr.argument, file, errors);
            break;

        case "MemberExpression":
            checkExpr(expr.object, file, errors);
            break;

        case "CallExpression":
            checkExpr(expr.callee, file, errors);
            for (const arg of expr.args) {
                if (arg.kind === "NamedArg") {
                    checkExpr(arg.value, file, errors);
                } else {
                    checkExpr(arg, file, errors);
                }
            }
            break;

        case "ListExpression":
            for (const item of expr.items) {
                checkExpr(item, file, errors);
            }
            break;

        default:
            // Literals, Identifiers, etc. are fine.
            break;
    }
}

function checkStmt(
    stmt: FluxStmt,
    file: string,
    errors: string[],
): void {
    switch (stmt.kind) {
        case "AssignmentStatement":
            checkExpr(stmt.value, file, errors);
            break;
        case "LetStatement":
            checkExpr(stmt.value, file, errors);
            break;
        default:
            // AdvanceDocstepStatement, ExpressionStatement, etc. — nothing to check yet.
            break;
    }
}

function collectRefCalls(
    prop: NodePropValue,
    node: DocumentNode,
    refs: { label: string; node: DocumentNode }[],
    diagnostics: string[],
    file: string,
): void {
    if (prop.kind !== "DynamicValue") return;
    visitExpr(prop.expr, (expr) => {
        if (expr.kind === "CallExpression" && expr.callee.kind === "Identifier" && expr.callee.name === "ref") {
            const first = expr.args?.[0];
            if (first && first.kind === "Literal" && typeof first.value === "string") {
                refs.push({ label: first.value, node });
            } else {
                diagnostics.push(
                    `${formatNodeLocation(file, node)}: Check error: ref() expects a literal string label`,
                );
            }
        }
    });
}

function isBooleanishExpr(expr: FluxExpr): boolean {
    switch (expr.kind) {
        case "Literal":
            return typeof expr.value === "boolean";
        case "UnaryExpression":
            return expr.op === "not" ? isBooleanishExpr(expr.argument) : false;
        case "BinaryExpression":
            if (expr.op === "and" || expr.op === "or") return true;
            if (["==", "!=", "===", "!==", "<", "<=", ">", ">="].includes(expr.op)) return true;
            return false;
        case "Identifier":
        case "MemberExpression":
        case "CallExpression":
            return true;
        case "ListExpression":
            return false;
        default:
            return false;
    }
}

function usesDynamicTime(expr: FluxExpr): boolean {
    let found = false;
    visitExpr(expr, (node) => {
        if (node.kind === "Identifier") {
            if (node.name === "time" || node.name === "timeSeconds" || node.name === "docstep") {
                found = true;
            }
        }
        if (node.kind === "CallExpression") {
            if (node.callee.kind === "Identifier") {
                const name = node.callee.name;
                if (
                    name === "choose" ||
                    name === "chooseStep" ||
                    name === "cycle" ||
                    name === "shuffle" ||
                    name === "sample" ||
                    name === "phase" ||
                    name === "hashpick"
                ) {
                    found = true;
                }
            }
            if (
                node.callee.kind === "MemberExpression" &&
                node.callee.object.kind === "Identifier" &&
                node.callee.object.name === "assets"
            ) {
                found = true;
            }
        }
    });
    return found;
}

function visitExpr(expr: FluxExpr, fn: (expr: FluxExpr) => void): void {
    fn(expr);
    switch (expr.kind) {
        case "BinaryExpression":
            visitExpr(expr.left, fn);
            visitExpr(expr.right, fn);
            break;
        case "UnaryExpression":
            visitExpr(expr.argument, fn);
            break;
        case "MemberExpression":
            visitExpr(expr.object, fn);
            break;
        case "CallExpression":
            visitExpr(expr.callee, fn);
            for (const arg of expr.args ?? []) {
                if (arg.kind === "NamedArg") {
                    visitExpr(arg.value, fn);
                } else {
                    visitExpr(arg, fn);
                }
            }
            break;
        case "ListExpression":
            for (const item of expr.items) {
                visitExpr(item, fn);
            }
            break;
        default:
            break;
    }
}
