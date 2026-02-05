export function resolveActionRoute(currentDoc, action) {
    if (!currentDoc) {
        return { route: "open", pendingAction: action };
    }
    return { route: action, pendingAction: null };
}
export function resolveRouteAfterOpen(pendingAction) {
    if (pendingAction) {
        return { route: pendingAction, pendingAction: null };
    }
    return { route: "doc", pendingAction: null };
}
//# sourceMappingURL=dashboard-machine.js.map