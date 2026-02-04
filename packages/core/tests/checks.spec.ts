import { describe, expect, it } from "vitest";
import { checkDocument, parseDocument } from "../src";

describe("Flux checks", () => {
  it("flags duplicate labels and missing refs", () => {
    const src = `
      document {
        meta { version = "0.3.0"; }
        body {
          page p1 {
            text a { label = "dup"; content = "A"; }
            text b { label = "dup"; content = "B"; }
            text c { content = @ref("missing"); }
          }
        }
      }
    `;
    const doc = parseDocument(src);
    const errors = checkDocument("<test>", doc);
    expect(errors.some((err) => err.includes("duplicate label"))).toBe(true);
    expect(errors.some((err) => err.includes("ref('missing')"))).toBe(true);
  });

  it("flags visibleIf depending on time", () => {
    const src = `
      document {
        meta { version = "0.3.0"; }
        body {
          page p1 {
            text a { visibleIf = @time > 0; content = "A"; }
          }
        }
      }
    `;
    const doc = parseDocument(src);
    const errors = checkDocument("<test>", doc);
    expect(errors.some((err) => err.includes("visibleIf"))).toBe(true);
  });
});
