export type AppRoute = "open" | "doc" | "new" | "export" | "doctor" | "format" | "edit" | "settings" | "add";

export type FocusTarget =
  | "nav"
  | "open.results"
  | "open.search"
  | "docDetails"
  | "wizard"
  | "export"
  | "doctor"
  | "format"
  | "edit"
  | "settings"
  | "palette"
  | "modal";

export function defaultFocusForRoute(route: AppRoute): FocusTarget {
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

export function isPaneFocus(target: FocusTarget) {
  return target !== "nav" && target !== "palette" && target !== "modal";
}
