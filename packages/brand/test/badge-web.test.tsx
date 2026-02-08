import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge, ChannelBadge, NpmBadge, renderBadgeSvg } from "../src/index.js";

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
    const npm = renderToStaticMarkup(<NpmBadge packageName="@flux-lang/flux" version="0.1.4" />);
    const channel = renderToStaticMarkup(<ChannelBadge channel="stable" packageName="@flux-lang/flux" />);

    expect(npm).toContain("@flux-lang/flux");
    expect(npm).toContain("v0.1.4");
    expect(channel).toContain("Channel");
    expect(channel).toContain("stable");
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
