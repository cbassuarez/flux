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

  it("renders inline slots as spans with inner span wrappers", () => {
    const src = `
      document {
        meta { version = "0.2.0"; }
        body {
          page p1 {
            text line {
              inline_slot word {
                reserve = fixedWidth(120, px);
                fit = ellipsis;
                text t1 { content = "Inline"; }
              }
            }
          }
        }
      }
    `;
    const doc = parseDocument(src);
    const ir = renderDocumentIR(doc);
    const { html } = renderHtml(ir);
    expect(html).toContain('<span class="flux-inline-slot');
    expect(html).toContain('data-flux-id="root/page:p1:0/text:line:0/inline_slot:word:0"');
    expect(html).toContain('<span class="flux-slot-inner" data-flux-slot-inner>');
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

  it("includes CSS for page numbering", () => {
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
    const { css } = renderHtml(ir);
    expect(css).toContain(".flux-page-number");
    expect(css).toContain("counter(flux-page)");
  });

  it("renders rich text and block nodes", () => {
    const src = `
      document {
        meta { version = "0.3.0"; }
        body {
          page p1 {
            text p1 {
              content = "Intro ";
              em e1 { content = "em"; }
              strong s1 { content = "strong"; }
              code c1 { content = "code"; }
              link l1 { href = "https://example.com"; content = "link"; }
              mark m1 { content = "mark"; }
              smallcaps sc1 { content = "caps"; }
              sub sub1 { content = "2"; }
              sup sup1 { content = "3"; }
              quote q1 { content = "quote"; }
            }
            blockquote b1 { text t1 { content = "Quoted block."; } }
            codeblock cb1 { content = "const x = 1;"; }
            callout c1 { tone = "note"; text t2 { content = "Callout text."; } }
            table tb1 { rows = [ ["A", "B"], ["C", "D"] ]; }
            ul list1 { li i1 { text t3 { content = "Item"; } } }
            footnote fn1 { content = "Footnote text."; }
          }
        }
      }
    `;
    const doc = parseDocument(src);
    const ir = renderDocumentIR(doc);
    const { html } = renderHtml(ir);
    expect(html).toContain("<em");
    expect(html).toContain("<strong");
    expect(html).toContain("flux-callout");
    expect(html).toContain("<blockquote");
    expect(html).toContain("<table");
    expect(html).toContain("flux-footnotes");
  });
});
