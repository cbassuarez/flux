import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge, ChannelBadge, FluxBadge, FLUX_BADGE_BASE_CLASSES, NpmBadge, renderBadgeSvg } from "../src/index.js";

describe("badge web helpers", () => {
  it("renders link, button, and span elements from badge interaction props", () => {
    const link = renderToStaticMarkup(
      <Badge kind="docs" label="Docs" value="site" href="https://flux-lang.org/docs" />,
    );
    const button = renderToStaticMarkup(
      <Badge kind="docs" label="Install" value="copy" onClick={() => undefined} />,
    );
    const span = renderToStaticMarkup(<Badge kind="docs" label="Docs" value="site" />);

    expect(link.startsWith("<a")).toBe(true);
    expect(button.startsWith("<button")).toBe(true);
    expect(span.startsWith("<span")).toBe(true);
  });

  it("formats npm and channel wrappers with default values", () => {
    const npm = renderToStaticMarkup(<NpmBadge packageName="@flux-lang/core" version="0.1.4" />);
    const channel = renderToStaticMarkup(<ChannelBadge channel="stable" packageName="@flux-lang/core" />);

    expect(npm).toContain("@flux-lang/core");
    expect(npm).toContain("v0.1.4");
    expect(channel).toContain("Channel");
    expect(channel).toContain("stable");
  });

  it("renders the canonical FluxBadge markup and base classes", () => {
    const html = renderToStaticMarkup(<FluxBadge version="1.2.3" />);

    expect(html).toContain(`class="${FLUX_BADGE_BASE_CLASSES}"`);
    expect(html).toContain("@flux-lang/flux");
    expect(html).toContain(">v1.2.3<");
  });

  it("keeps a v-prefixed version label", () => {
    const html = renderToStaticMarkup(<FluxBadge version="v1.2.3" />);
    expect(html).toContain(">v1.2.3<");
  });

  it("falls back to v0.0.0-dev when no version is available", () => {
    const prev = process.env.FLUX_VERSION;
    process.env.FLUX_VERSION = "";

    try {
      const html = renderToStaticMarkup(<FluxBadge />);
      expect(html).toContain(">v0.0.0-dev<");
    } finally {
      if (prev === undefined) {
        delete process.env.FLUX_VERSION;
      } else {
        process.env.FLUX_VERSION = prev;
      }
    }
  });

  it("renders static svg badges without external references", () => {
    const svg = renderBadgeSvg({
      kind: "ci",
      label: "CI",
      value: "passing",
      theme: "dark",
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain("CI");
    expect(svg).toContain("passing");
    expect(svg).not.toContain('href="http');
    expect(svg).not.toContain("xlink:href=");
    expect(svg).not.toContain("<image");
  });
});
