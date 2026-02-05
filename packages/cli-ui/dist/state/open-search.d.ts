import type { AppRoute, FocusTarget } from "./focus.js";
export declare function shouldEnterOpenSearch(params: {
    route: AppRoute;
    focusTarget: FocusTarget;
    input?: string;
    key?: {
        ctrl?: boolean;
        meta?: boolean;
    };
}): boolean;
export declare function shouldExitOpenSearch(params: {
    focusTarget: FocusTarget;
    key?: {
        escape?: boolean;
    };
}): boolean;
export declare function applyOpenSearchInput(params: {
    focusTarget: FocusTarget;
    query: string;
    input?: string;
    key?: {
        backspace?: boolean;
        delete?: boolean;
    };
}): string;
//# sourceMappingURL=open-search.d.ts.map