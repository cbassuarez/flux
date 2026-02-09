import { describe, expect, it } from "vitest";
import { parseDocument, renderDocumentIR } from "@flux-lang/core";
import { renderHtml } from "../src/index";

function renderDoc(source: string) {
  const doc = parseDocument(source);
  const ir = renderDocumentIR(doc);
  return renderHtml(ir);
}

function extractSlotInner(html: string, className: string): string | null {
  const regex = new RegExp(
    `<${className === "flux-inline-slot" ? "span" : "div"} class="${className}[^"]*"[^>]*>\\s*` +
      `<${className === "flux-inline-slot" ? "span" : "div"} class="flux-slot-inner"[^>]*>([\\s\\S]*?)<\\/${className === "flux-inline-slot" ? "span" : "div"}>\\s*` +
      `<\\/${className === "flux-inline-slot" ? "span" : "div"}>`,
    "m",
  );
  const match = html.match(regex);
  return match?.[1] ?? null;
}

describe("slot structure", () => {
  it("renders slot children inside the slot wrapper", () => {
    const { html } = renderDoc(`
      document {
        meta { version = "0.2.0"; }
        body {
          page p1 {
            slot hero {
              reserve = fixed(200, 80, px);
              image heroImg { src = "/img.png"; }
            }
          }
        }
      }
    `);
    const inner = extractSlotInner(html, "flux-slot");
    expect(inner).toBeTruthy();
    expect(inner).toContain('data-flux-src="/img.png"');
    expect(html).not.toMatch(
      /flux-slot[^>]*>\s*<div class="flux-slot-inner"[^>]*>\s*<\/div>\s*<\/div>\s*<img[^>]*data-flux-src="\/img\.png"/,
    );
  });

  it("renders slot text inside the reserved box", () => {
    const { html } = renderDoc(`
      document {
        meta { version = "0.2.0"; }
        body {
          page p1 {
            slot caption {
              reserve = fixed(180, 40, px);
              fit = shrink;
              text t1 { content = "Fit policy matrix"; }
            }
          }
        }
      }
    `);
    const inner = extractSlotInner(html, "flux-slot");
    expect(inner).toBeTruthy();
    const normalized = inner?.replace(/\u00ad/g, "") ?? "";
    expect(normalized).toContain("Fit policy matrix");
  });

  it("renders inline_slot children inside the inline wrapper", () => {
    const { html } = renderDoc(`
      document {
        meta { version = "0.2.0"; }
        body {
          page p1 {
            text line {
              inline_slot word {
                reserve = fixedWidth(140, px);
                fit = ellipsis;
                text t1 { content = "Inline slot text"; }
              }
            }
          }
        }
      }
    `);
    const inner = extractSlotInner(html, "flux-inline-slot");
    expect(inner).toBeTruthy();
    const normalized = inner?.replace(/\u00ad/g, "") ?? "";
    expect(normalized).toContain("Inline slot text");
  });

  it("keeps figure slots wrapped around their images", () => {
    const { html } = renderDoc(`
      document {
        meta { version = "0.2.0"; }
        body {
          page p1 {
            figure fig1 {
              slot figureSlot {
                reserve = fixed(200, 120, px);
                image figImg { src = "/figure.png"; }
              }
            }
          }
        }
      }
    `);
    const inner = extractSlotInner(html, "flux-slot");
    expect(inner).toBeTruthy();
    expect(inner).toContain('data-flux-src="/figure.png"');
  });
});
