import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parseDocument } from "../src/parser";
import { createDocumentRuntime, renderDocument } from "../src/render";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const findNodeById = (nodes: any[], id: string): any | undefined => {
  for (const node of nodes ?? []) {
    if (node?.id === id) return node;
    const child = findNodeById(node?.children ?? [], id);
    if (child) return child;
  }
  return undefined;
};

describe("Flux render IR v0.2", () => {
  it("is deterministic for the same seed/time/docstep", () => {
    const src = `
      document {
        meta { version = "0.2.0"; }
        body {
          page p1 {
            text t1 { content = @choose(["a", "b", "c"]); }
          }
        }
      }
    `;
    const doc = parseDocument(src);
    const first = renderDocument(doc, { seed: 42 });
    const second = renderDocument(doc, { seed: 42 });
    expect(second).toEqual(first);
  });

  it("chooseStep selects by docstep deterministically", () => {
    const src = `
      document {
        meta { version = "0.2.0"; }
        body {
          page p1 {
            text t1 { refresh = onDocstep; content = @chooseStep(["a", "b", "c"]); }
          }
        }
      }
    `;
    const doc = parseDocument(src);

    const step0 = renderDocument(doc, { docstep: 0 });
    const step1 = renderDocument(doc, { docstep: 1 });
    const step3 = renderDocument(doc, { docstep: 3 });

    const v0 = step0.body[0].children[0].props.content;
    const v1 = step1.body[0].children[0].props.content;
    const v3 = step3.body[0].children[0].props.content;

    expect(v0).toBe("a");
    expect(v1).toBe("b");
    expect(v3).toBe("a");
  });

  it("chooseStep rejects empty lists", () => {
    const src = `
      document {
        meta { version = "0.2.0"; }
        body {
          page p1 {
            text t1 { content = @chooseStep([]); }
          }
        }
      }
    `;
    const doc = parseDocument(src);
    expect(() => renderDocument(doc, { docstep: 0 })).toThrow(
      "chooseStep(list) expects a non-empty list",
    );
  });

  it("scopes refresh to onLoad vs onDocstep", () => {
    const src = `
      document {
        meta { version = "0.2.0"; }
        body {
          page p1 {
            text static { refresh = onLoad; content = @"step " + docstep; }
            text dynamic { refresh = onDocstep; content = @"step " + docstep; }
          }
        }
      }
    `;

    const doc = parseDocument(src);
    const runtime = createDocumentRuntime(doc, { seed: 1 });

    const first = runtime.render();
    const second = runtime.step(1);

    const firstStatic = first.body[0].children[0].props.content;
    const firstDynamic = first.body[0].children[1].props.content;
    const secondStatic = second.body[0].children[0].props.content;
    const secondDynamic = second.body[0].children[1].props.content;

    expect(firstStatic).toBe("step 0");
    expect(secondStatic).toBe("step 0");
    expect(firstDynamic).toBe("step 0");
    expect(secondDynamic).toBe("step 1");
  });

  it("refreshes every(Ns) on the correct time bucket", () => {
    const src = `
      document {
        meta { version = "0.2.0"; }
        body {
          page p1 {
            text t1 { refresh = every(5s); content = @"t=" + time; }
          }
        }
      }
    `;

    const doc = parseDocument(src);
    const runtime = createDocumentRuntime(doc);

    const first = runtime.render();
    const mid = runtime.tick(3);
    const later = runtime.tick(2);

    expect(first.body[0].children[0].props.content).toBe("t=0");
    expect(mid.body[0].children[0].props.content).toBe("t=0");
    expect(later.body[0].children[0].props.content).toBe("t=5");
  });

  it("resolves assets.pick to stable asset refs", () => {
    const src = `
      document {
        meta { version = "0.2.0"; }
        assets {
          asset hero { kind = image; path = "img/hero.png"; tags = [ hero ]; }
          asset alt { kind = image; path = "img/alt.png"; tags = [ hero ]; }
        }
        body {
          page p1 {
            image i1 { asset = @assets.pick(tags=[hero]); }
          }
        }
      }
    `;
    const doc = parseDocument(src);
    const rendered = renderDocument(doc, { seed: 7 });
    expect(rendered).toMatchSnapshot();
  });

  it("renders legacy v0.1 examples into a default body", () => {
    const heroPath = path.join(__dirname, "..", "..", "..", "examples", "hero-test-doc.flux");
    const heroSource = readFileSync(heroPath, "utf8");
    const doc = parseDocument(heroSource);
    const rendered = renderDocument(doc, { seed: 0, docstep: 1 });
    expect(rendered.body.length).toBeGreaterThan(0);
    expect(rendered.body[0].children.length).toBeGreaterThan(0);
  });

  it("renders the viewer demo with stable assets and slot updates", () => {
    const demoPath = path.join(__dirname, "..", "..", "..", "examples", "viewer-demo.flux");
    const demoSource = readFileSync(demoPath, "utf8");
    const doc = parseDocument(demoSource);
    const assetCwd = path.dirname(demoPath);

    const step0 = renderDocument(doc, { seed: 1, docstep: 0, time: 0, assetCwd });
    const step1 = renderDocument(doc, { seed: 1, docstep: 1, time: 1, assetCwd });

    const hero0 = findNodeById(step0.body, "heroImg");
    const hero1 = findNodeById(step1.body, "heroImg");
    expect(hero0?.props?.asset).not.toBeNull();
    expect(hero1?.props?.asset).not.toBeNull();

    const word0 = findNodeById(step0.body, "wordValue");
    const word1 = findNodeById(step1.body, "wordValue");
    expect(word0?.props?.content).not.toBe(word1?.props?.content);

    const editionStep0 = findNodeById(step0.body, "editionStepValue");
    const editionStep1 = findNodeById(step1.body, "editionStepValue");
    expect(editionStep0?.props?.content).not.toBe(editionStep1?.props?.content);

    const editionTime0 = findNodeById(step0.body, "editionTimeValue");
    const editionTime1 = findNodeById(step1.body, "editionTimeValue");
    expect(editionTime0?.props?.content).not.toBe(editionTime1?.props?.content);

    const assetIds = Array.from({ length: 6 }, (_, index) => {
      const rendered = renderDocument(doc, { seed: 1, docstep: index, assetCwd });
      const hero = findNodeById(rendered.body, "heroImg");
      return hero?.props?.asset?.id ?? null;
    });
    const distinct = new Set(assetIds);
    expect(distinct.size).toBeGreaterThan(1);
  });
});
