/**
 * Run basic static checks on a FluxDocument.
 *
 * This is used by the CLI and can also be consumed by editor integrations.
 *
 * @param file - A label for the source (path or "<buffer>").
 * @param doc  - Parsed FluxDocument AST.
 * @returns An array of human-readable diagnostic strings.
 */
export function checkDocument(file, doc) {
    const errors = [];
    const gridNames = new Set(doc.grids.map((g) => g.name));
    for (const rule of doc.rules ?? []) {
        // grid=foo scope must refer to an existing grid
        if (rule.scope?.grid && !gridNames.has(rule.scope.grid)) {
            errors.push(`${file}:0:0: Check error: Rule '${rule.name}' references unknown grid '${rule.scope.grid}'`);
        }
        // Expression-level checks (neighbors.* etc.)
        checkRuleExpressions(file, rule, errors);
    }
    // Runtime timers sanity check
    if (doc.runtime?.docstepAdvance) {
        for (const spec of doc.runtime.docstepAdvance) {
            if (spec.kind === "timer" && spec.amount <= 0) {
                errors.push(`${file}:0:0: Check error: timer(...) amount must be positive (found ${spec.amount})`);
            }
        }
    }
    return errors;
}
function checkRuleExpressions(file, rule, errors) {
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
    const anyRule = rule;
    if (Array.isArray(anyRule.branches)) {
        for (const branch of anyRule.branches) {
            checkExpr(branch.condition, file, errors);
            for (const stmt of branch.thenBranch) {
                checkStmt(stmt, file, errors);
            }
        }
    }
}
function checkExpr(expr, file, errors) {
    switch (expr.kind) {
        case "NeighborsCallExpression":
            if (expr.method !== "all" && expr.method !== "orth") {
                errors.push(`${file}:0:0: Check error: Unsupported neighbors method '${expr.method}'`);
            }
            for (const arg of expr.args) {
                checkExpr(arg, file, errors);
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
                checkExpr(arg, file, errors);
            }
            break;
        default:
            // Literals, Identifiers, etc. are fine.
            break;
    }
}
function checkStmt(stmt, file, errors) {
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
//# sourceMappingURL=checks.js.map