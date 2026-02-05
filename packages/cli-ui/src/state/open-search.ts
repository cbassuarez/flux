import type { AppRoute, FocusTarget } from "./focus.js";
import { sanitizePrintableInput } from "../ui/input.js";

export function shouldEnterOpenSearch(params: {
  route: AppRoute;
  focusTarget: FocusTarget;
  input?: string;
  key?: { ctrl?: boolean; meta?: boolean };
}) {
  if (params.route !== "open") return false;
  if (params.focusTarget === "open.search") return false;
  if (!params.input) return false;
  if (params.key?.ctrl || params.key?.meta) return false;
  return params.input === "/";
}

export function shouldExitOpenSearch(params: { focusTarget: FocusTarget; key?: { escape?: boolean } }) {
  return params.focusTarget === "open.search" && Boolean(params.key?.escape);
}

export function applyOpenSearchInput(params: {
  focusTarget: FocusTarget;
  query: string;
  input?: string;
  key?: { backspace?: boolean; delete?: boolean };
}) {
  if (params.focusTarget !== "open.search") return params.query;
  if (params.key?.backspace || params.key?.delete) {
    return params.query.slice(0, -1);
  }
  const printable = sanitizePrintableInput(params.input);
  if (!printable) return params.query;
  return params.query + printable;
}
