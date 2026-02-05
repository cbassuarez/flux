export function defaultFocusForRoute(route) {
    switch (route) {
        case "open":
            return "open.results";
        case "doc":
            return "docDetails";
        case "new":
            return "wizard";
        case "export":
            return "export";
        case "doctor":
            return "doctor";
        case "format":
            return "format";
        case "edit":
            return "edit";
        case "settings":
            return "settings";
        default:
            return "open.results";
    }
}
export function isPaneFocus(target) {
    return target !== "nav" && target !== "palette" && target !== "help" && target !== "modal";
}
export function isModalFocus(target) {
    return target === "palette" || target === "help" || target === "modal";
}
//# sourceMappingURL=focus.js.map