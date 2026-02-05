export type PendingAction = "edit" | "export" | "doctor" | "format" | null;
export type DashboardRoute = "open" | "doc" | "new" | "export" | "doctor" | "format" | "edit";

export function resolveActionRoute(
  currentDoc: string | null,
  action: Exclude<PendingAction, null>,
): { route: DashboardRoute; pendingAction: PendingAction } {
  if (!currentDoc) {
    return { route: "open", pendingAction: action };
  }
  return { route: action, pendingAction: null };
}

export function resolveRouteAfterOpen(
  pendingAction: PendingAction,
): { route: DashboardRoute; pendingAction: PendingAction } {
  if (pendingAction) {
    return { route: pendingAction, pendingAction: null };
  }
  return { route: "doc", pendingAction: null };
}
