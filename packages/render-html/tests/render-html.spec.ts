import { describe, expect, it } from "vitest";
import { parseDocument, renderDocumentIR } from "@flux-lang/core";
import { renderHtml, renderSlotMap } from "../src/index";

describe("render-html", () => {
  it("renders stable data-flux-id attributes", () => {
    const src = `
      document {
        meta { version = "0.2.0"; }
        body {
          page p1 {
            text t1 { content = "Hello"; }
          }
        }
      }
    `;
    const doc = parseDocument(src);
    const ir = renderDocumentIR(doc);
    const { html } = renderHtml(ir);
    expect(html).toContain('data-flux-id="root/page:p1:0"');
    expect(html).toContain('data-flux-id="root/page:p1:0/text:t1:0"');
  });

  it("renders slots with fit and reserve hooks", () => {
    const src = `
      document {
        meta { version = "0.2.0"; }
        body {
          page p1 {
            slot hero {
              reserve = fixed(200, 80, px);
              fit = clip;
              text t1 { content = "Swap"; }
            }
            inline_slot word {
              reserve = fixedWidth(140, px);
              fit = ellipsis;
              text t2 { content = "Inline"; }
            }
          }
        }
      }
    `;
    const doc = parseDocument(src);
    const ir = renderDocumentIR(doc);
    const { html } = renderHtml(ir);
    expect(html).toContain('data-flux-fit="clip"');
    expect(html).toContain('class="flux-slot');
    expect(html).toContain('class="flux-inline-slot');
  });

  it("sizes slot-contained images to fill reserved geometry", () => {
    const src = `
      document {
        meta { version = "0.2.0"; }
        assets {
          asset hero { kind = image; path = "img/hero.png"; tags = [ hero ]; }
        }
        body {
          page p1 {
            slot hero {
              reserve = fixed(200, 80, px);
              fit = clip;
              image heroImg { asset = @assets.pick(tags=["hero"]); }
            }
          }
        }
      }
    `;
    const doc = parseDocument(src);
    const ir = renderDocumentIR(doc, { seed: 1 });
    const { html, css } = renderHtml(ir);
    expect(html).toContain('class="flux-slot');
    expect(html).toContain('class="flux-image"');
    expect(css).toContain(".flux-slot-inner > .flux-image");
    expect(css).toContain("object-fit: contain");
  });

  it("builds slot inner HTML for inline slots and images", () => {
    const src = `
      document {
        meta { version = "0.2.0"; }
        assets {
          asset hero { kind = image; path = "img/hero.png"; tags = [ hero ]; }
        }
        body {
          page p1 {
            text line {
              inline_slot word {
                text t1 { content = "Live <tag>"; }
              }
            }
            slot hero {
              reserve = fixed(200, 80, px);
              image heroImg { asset = @assets.pick(tags=["hero"]); }
            }
          }
        }
      }
    `;
    const doc = parseDocument(src);
    const ir = renderDocumentIR(doc, { seed: 1 });
    const assetId = ir.assets[0]?.id ?? "";
    const slots = renderSlotMap(ir, { assetUrl: (id) => `/assets/${id}` });
    const inlineEntry = Object.entries(slots).find(([key]) => key.includes("inline_slot"));
    expect(inlineEntry).toBeTruthy();
    expect(inlineEntry?.[1]).toContain("Live &lt;tag&gt;");
    const heroEntry = Object.entries(slots).find(([key]) => key.includes("slot:hero"));
    expect(heroEntry).toBeTruthy();
    expect(heroEntry?.[1]).toContain("<img");
    expect(heroEntry?.[1]).toContain(`src="/assets/${assetId}"`);
  });
});
