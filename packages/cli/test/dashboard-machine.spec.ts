import { describe, it, expect } from "vitest";
import { resolveActionRoute, resolveRouteAfterOpen } from "@flux-lang/cli-ui";

describe("dashboard state machine", () => {
  it("routes to open and sets pending action when no current doc", () => {
    const result = resolveActionRoute(null, "export");
    expect(result).toEqual({ route: "open", pendingAction: "export" });
  });

  it("routes to open and sets pending edit when no current doc", () => {
    const result = resolveActionRoute(null, "edit");
    expect(result).toEqual({ route: "open", pendingAction: "edit" });
  });

  it("routes directly to action when current doc exists", () => {
    const result = resolveActionRoute("/tmp/demo.flux", "doctor");
    expect(result).toEqual({ route: "doctor", pendingAction: null });
  });

  it("continues to the pending action after opening a document", () => {
    const result = resolveRouteAfterOpen("format");
    expect(result).toEqual({ route: "format", pendingAction: null });
  });

  it("continues to edit after opening a document", () => {
    const result = resolveRouteAfterOpen("edit");
    expect(result).toEqual({ route: "edit", pendingAction: null });
  });

  it("returns to doc details when no pending action exists", () => {
    const result = resolveRouteAfterOpen(null);
    expect(result).toEqual({ route: "doc", pendingAction: null });
  });
});
