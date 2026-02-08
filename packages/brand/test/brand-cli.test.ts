import { describe, expect, it } from "vitest";
import stripAnsi from "strip-ansi";
import { FLUX_TAGLINE, coerceVersionInfo } from "../src/index.js";
import { renderCliBrandHeader } from "../src/cli.js";

describe("CLI brand header", () => {
  const info = coerceVersionInfo({ version: "0.1.4" });

  it("renders version and tagline text", () => {
    const rendered = renderCliBrandHeader({ info, isOnline: true });
    const plain = stripAnsi(rendered);

    expect(plain).toContain("flux v0.1.4");
    expect(plain).toContain(FLUX_TAGLINE);
  });

  it("keeps plain text stable while ANSI styling changes by online state", () => {
    const online = renderCliBrandHeader({ info, isOnline: true });
    const offline = renderCliBrandHeader({ info, isOnline: false });

    expect(online).not.toBe(offline);
    expect(stripAnsi(online)).toBe(stripAnsi(offline));
    expect(online).toContain("\u001b[38;2;");
  });
});
