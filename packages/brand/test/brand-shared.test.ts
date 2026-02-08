import { describe, expect, it } from "vitest";
import { FLUX_TAGLINE, coerceVersionInfo, formatFluxVersion } from "../src/index.js";

describe("shared brand helpers", () => {
  it("coerces version info and enforces the shared tagline", () => {
    const info = coerceVersionInfo({ version: "v0.1.4", channel: "canary", build: "42", sha: "abc" });

    expect(info.version).toBe("0.1.4");
    expect(info.channel).toBe("canary");
    expect(info.build).toBe("42");
    expect(info.sha).toBe("abc");
    expect(info.tagline).toBe(FLUX_TAGLINE);
  });

  it("formats versions with a single leading v", () => {
    expect(formatFluxVersion("0.1.4")).toBe("v0.1.4");
    expect(formatFluxVersion("v0.1.4")).toBe("v0.1.4");
    expect(formatFluxVersion("vv0.1.4")).toBe("v0.1.4");
  });
});
