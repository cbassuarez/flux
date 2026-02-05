import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parseDocument } from "../src/parser";
import { createDocumentRuntime, renderDocument, renderDocumentIR } from "../src/render";

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
            slot s1 {
              refresh = docstep;
              text t1 { content = @chooseStep(["a", "b", "c"]); }
            }
          }
        }
      }
    `;
    const doc = parseDocument(src);

    const step0 = renderDocument(doc, { docstep: 0 });
    const step1 = renderDocument(doc, { docstep: 1 });
    const step3 = renderDocument(doc, { docstep: 3 });

    const v0 = findNodeById(step0.body, "t1")?.props?.content;
    const v1 = findNodeById(step1.body, "t1")?.props?.content;
    const v3 = findNodeById(step3.body, "t1")?.props?.content;

    expect(v0).toBe("a");
    expect(v1).toBe("b");
    expect(v3).toBe("a");
  });

  it("evaluates helper functions deterministically", () => {
    const src = `
      document {
        meta { version = "0.2.0"; }
        body {
          page p1 {
            section helpers {
              dataCycle = @cycle(["a", "b", "c"]);
              dataHash = @hashpick(["x", "y", "z"], "key-42");
              dataPhase = @phase(2.25);
              dataLerp = @lerp(10, 20, 0.25);
              dataShuffle = @shuffle([1, 2, 3, 4]);
              dataSample = @sample([1, 2, 3, 4], 2);
            }
          }
        }
      }
    `;
    const doc = parseDocument(src);
    const first = renderDocument(doc, { seed: 123, docstep: 5, time: 2.25 });
    const second = renderDocument(doc, { seed: 123, docstep: 5, time: 2.25 });
    expect(second).toEqual(first);

    const helpers = findNodeById(first.body, "helpers");
    expect(helpers?.props?.dataCycle).toBe("c");
    expect(helpers?.props?.dataPhase).toBeCloseTo(0.25);
    expect(helpers?.props?.dataLerp).toBeCloseTo(12.5);

    const shuffled = helpers?.props?.dataShuffle as number[];
    expect(Array.isArray(shuffled)).toBe(true);
    expect(shuffled).toHaveLength(4);
    expect(shuffled.sort()).toEqual([1, 2, 3, 4]);

    const sample = helpers?.props?.dataSample as number[];
    expect(Array.isArray(sample)).toBe(true);
    expect(sample).toHaveLength(2);
    sample.forEach((value) => expect([1, 2, 3, 4]).toContain(value));
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

  it("scopes refresh to never vs docstep", () => {
    const src = `
      document {
        meta { version = "0.2.0"; }
        body {
          page p1 {
            slot staticSlot {
              refresh = never;
              text static { content = @"step " + docstep; }
            }
            slot dynamicSlot {
              refresh = docstep;
              text dynamic { content = @"step " + docstep; }
            }
          }
        }
      }
    `;

    const doc = parseDocument(src);
    const runtime = createDocumentRuntime(doc, { seed: 1 });

    const first = runtime.render();
    const second = runtime.step(1);

    const firstStatic = findNodeById(first.body, "static")?.props?.content;
    const firstDynamic = findNodeById(first.body, "dynamic")?.props?.content;
    const secondStatic = findNodeById(second.body, "static")?.props?.content;
    const secondDynamic = findNodeById(second.body, "dynamic")?.props?.content;

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
            slot s1 {
              refresh = every("5s");
              text t1 { content = @"t=" + time; }
            }
          }
        }
      }
    `;

    const doc = parseDocument(src);
    const runtime = createDocumentRuntime(doc);

    const first = runtime.render();
    const mid = runtime.tick(3);
    const later = runtime.tick(2);

    expect(findNodeById(first.body, "t1")?.props?.content).toBe("t=0");
    expect(findNodeById(mid.body, "t1")?.props?.content).toBe("t=0");
    expect(findNodeById(later.body, "t1")?.props?.content).toBe("t=5");
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
            image i1 { asset = @assets.pick(tags=["hero"]); }
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
    const step1 = renderDocument(doc, { seed: 1, docstep: 0, time: 1.2, assetCwd });
    const step3 = renderDocument(doc, { seed: 1, docstep: 0, time: 3, assetCwd });

    const hero0 = findNodeById(step0.body, "heroImg");
    const hero1 = findNodeById(step1.body, "heroImg");
    expect(hero0?.props?.asset).not.toBeNull();
    expect(hero1?.props?.asset).not.toBeNull();

    const word0 = findNodeById(step0.body, "pillValue");
    const word1 = findNodeById(step1.body, "pillValue");
    expect(word0?.props?.content).not.toBe(word1?.props?.content);

    const reveal0 = findNodeById(step0.body, "revealText");
    const reveal3 = findNodeById(step3.body, "revealText");
    expect(reveal0?.props?.content ?? "").not.toBe(reveal3?.props?.content ?? "");
  });

  it("resolves refs with section/figure/table counters", () => {
    const src = `
      document {
        meta { version = "0.3.0"; }
        body {
          page p1 {
            text h1 { variant = "heading"; label = "sec:intro"; content = "Intro"; }
            text t1 { content = @"See " + ref("fig:hero"); }
            figure f1 { label = "fig:hero"; image img { src = "hero.png"; } }
            table tab1 { label = "tab:one"; rows = [ ["A", "B"], ["C", "D"] ]; }
            footnote fn1 { label = "fn:one"; content = "Footnote body."; }
          }
        }
      }
    `;
    const doc = parseDocument(src);
    const rendered = renderDocument(doc, { seed: 1 });
    const t1 = findNodeById(rendered.body, "t1");
    expect(t1?.props?.content).toBe("See Figure 1");

    const ir = renderDocumentIR(doc, { seed: 1 });
    const fig = findNodeById(ir.body, "f1");
    const tab = findNodeById(ir.body, "tab1");
    const sec = findNodeById(ir.body, "h1");
    const fn = findNodeById(ir.body, "fn1");
    expect(fig?.counters?.figure).toBe(1);
    expect(tab?.counters?.table).toBe(1);
    expect(sec?.counters?.section).toBe("1");
    expect(fn?.counters?.footnote).toBe(1);
  });

  it("supports asset excludeTags and shuffle", () => {
    const src = `
      document {
        meta { version = "0.3.0"; }
        assets {
          asset hero { kind = image; path = "img/hero.png"; tags = [ hero ]; }
          asset skip { kind = image; path = "img/skip.png"; tags = [ hero, skip ]; }
        }
        body {
          page p1 {
            image i1 { asset = @assets.pick(tags=["hero"], excludeTags=["skip"]); }
            section s1 { order = @assets.shuffle(tags=["hero"]); }
          }
        }
      }
    `;
    const doc = parseDocument(src);
    const rendered = renderDocument(doc, { seed: 1 });
    const img = findNodeById(rendered.body, "i1");
    expect(img?.props?.asset?.name).toBe("hero");
    const s1 = findNodeById(rendered.body, "s1");
    expect(Array.isArray(s1?.props?.order)).toBe(true);
    expect((s1?.props?.order as any[]).length).toBe(2);
  });
});
