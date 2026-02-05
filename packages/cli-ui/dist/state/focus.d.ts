export type AppRoute = "open" | "doc" | "new" | "export" | "doctor" | "format" | "edit" | "settings" | "add";
export type FocusTarget = "nav" | "open.results" | "open.search" | "docDetails" | "wizard" | "export" | "doctor" | "format" | "edit" | "settings" | "palette" | "modal";
export declare function defaultFocusForRoute(route: AppRoute): FocusTarget;
export declare function isPaneFocus(target: FocusTarget): target is "export" | "doctor" | "format" | "edit" | "settings" | "open.results" | "open.search" | "docDetails" | "wizard";
//# sourceMappingURL=focus.d.ts.map