import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FLUX_TAGLINE } from "../src/index.js";
import { FluxBrandHeader } from "../src/web.js";

describe("web brand header", () => {
  it("renders lockup text, tagline, mark, and ligature hooks", () => {
    const html = renderToStaticMarkup(<FluxBrandHeader info={{ version: "0.1.4" }} variant="header" />);

    expect(html).toContain("flux");
    expect(html).toContain("v0.1.4");
    expect(html).toContain(FLUX_TAGLINE);
    expect(html).toContain('data-testid="flux-mark"');
    expect(html).toContain('data-flux-ligatures="enabled"');
    expect(html).toContain("flux-brand-wordmark");
  });
});
