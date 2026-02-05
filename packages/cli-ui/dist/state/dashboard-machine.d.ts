export type PendingAction = "edit" | "export" | "doctor" | "format" | null;
export type DashboardRoute = "open" | "doc" | "new" | "export" | "doctor" | "format" | "edit";
export declare function resolveActionRoute(currentDoc: string | null, action: Exclude<PendingAction, null>): {
    route: DashboardRoute;
    pendingAction: PendingAction;
};
export declare function resolveRouteAfterOpen(pendingAction: PendingAction): {
    route: DashboardRoute;
    pendingAction: PendingAction;
};
//# sourceMappingURL=dashboard-machine.d.ts.map