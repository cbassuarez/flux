import { describe, expect, it } from "vitest";
import { defaultFocusForRoute } from "../src/state/focus.js";
import { applyOpenSearchInput, shouldEnterOpenSearch, shouldExitOpenSearch } from "../src/state/open-search.js";

describe("open search focus", () => {
  it("defaults to results focus on open", () => {
    expect(defaultFocusForRoute("open")).not.toBe("open.search");
  });

  it("enters search on /", () => {
    expect(shouldEnterOpenSearch({ route: "open", focusTarget: "open.results", input: "/" })).toBe(true);
  });

  it("exits search on escape", () => {
    expect(shouldExitOpenSearch({ focusTarget: "open.search", key: { escape: true } })).toBe(true);
  });

  it("ignores typing when focus is results", () => {
    const next = applyOpenSearchInput({ focusTarget: "open.results", query: "", input: "a" });
    expect(next).toBe("");
  });

  it("updates query when focus is search", () => {
    const next = applyOpenSearchInput({ focusTarget: "open.search", query: "", input: "a" });
    expect(next).toBe("a");
  });
});
