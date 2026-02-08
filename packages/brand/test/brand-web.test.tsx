import { describe, expect, it } from "vitest";
import { Children, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FLUX_TAGLINE } from "../src/index.js";
import { FluxBrandHeader, FluxWordmark } from "../src/web.js";

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

  it("renders color mark mode with direct image rendering", () => {
    const html = renderToStaticMarkup(
      <FluxBrandHeader info={{ version: "0.1.4" }} variant="header" markRenderMode="color" />,
    );

    expect(html).toContain("<img");
    expect(html).toContain('src="/flux-mark-favicon.svg"');
    expect(html).not.toContain("<mask");
  });

  it("renders the wordmark as four styled letter spans", () => {
    const wordmark = FluxWordmark({});
    expect(isValidElement(wordmark)).toBe(true);
    if (!isValidElement(wordmark)) return;

    const letters = Children.toArray(wordmark.props.children).filter(isValidElement) as ReactElement[];
    expect(letters).toHaveLength(4);

    const expected = [
      { letter: "f", className: "flux-brand-wordmark-letter-f", fontStyle: "italic", fontWeight: 600 },
      { letter: "l", className: "flux-brand-wordmark-letter-l", fontStyle: "italic", fontWeight: 500 },
      { letter: "u", className: "flux-brand-wordmark-letter-u", fontStyle: "normal", fontWeight: 400 },
      { letter: "x", className: "flux-brand-wordmark-letter-x", fontStyle: "normal", fontWeight: 300 },
    ] as const;

    expected.forEach((entry, index) => {
      const glyph = letters[index];
      expect(glyph.type).toBe("span");
      expect(glyph.props.children).toBe(entry.letter);
      expect(glyph.props.className).toContain("flux-brand-wordmark-letter");
      expect(glyph.props.className).toContain(entry.className);
      expect(glyph.props.style).toMatchObject({
        fontStyle: entry.fontStyle,
        fontWeight: entry.fontWeight,
      });
    });
  });
});
