import { describe, expect, it } from "vitest";
import { stripTrailingCommasInLists } from "../src/new/templates.js";

describe("stripTrailingCommasInLists", () => {
  it("removes trailing comma in a single-line list", () => {
    const input = `[ "a", "b", ]`;
    const output = stripTrailingCommasInLists(input);
    expect(output).toBe(`[ "a", "b" ]`);
  });

  it("removes trailing comma across newlines and indentation", () => {
    const input = [
      "rows = [",
      "  [\"a\", \"b\"],",
      "  [\"c\", \"d\"],",
      "]",
    ].join("\n");
    const output = stripTrailingCommasInLists(input);
    const expected = [
      "rows = [",
      "  [\"a\", \"b\"],",
      "  [\"c\", \"d\"]",
      "]",
    ].join("\n");
    expect(output).toBe(expected);
  });

  it("ignores commas inside strings", () => {
    const input = `content = "x, ] y";`;
    const output = stripTrailingCommasInLists(input);
    expect(output).toBe(input);
  });

  it("ignores commas inside comments", () => {
    const input = [
      "rows = [",
      "  \"a\" // , ]",
      "]",
    ].join("\n");
    const output = stripTrailingCommasInLists(input);
    expect(output).toBe(input);
  });

  it("handles nested list literals", () => {
    const input = `rows = [[\"a\",\"b\"], [\"c\",\"d\"],]`;
    const output = stripTrailingCommasInLists(input);
    expect(output).toBe(`rows = [[\"a\",\"b\"], [\"c\",\"d\"]]`);
  });
});
