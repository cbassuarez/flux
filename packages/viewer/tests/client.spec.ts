import { describe, expect, it } from "vitest";
import { getViewerJs, noCacheHeaders } from "../src/index";

describe("viewer client updates", () => {
  it("wires SSE updates and applies incoming IR", () => {
    const js = getViewerJs();
    expect(js).toContain("new EventSource");
    expect(js).toContain("/api/stream");
    expect(js).toContain("sse.onmessage");
    expect(js).toContain("applyIrPayload");
  });

  it("falls back to polling with no-store fetch", () => {
    const js = getViewerJs();
    expect(js).toContain("sse.onerror");
    expect(js).toContain("startPolling");
    expect(js).toContain('cache: "no-store"');
  });
});

describe("viewer cache headers", () => {
  it("sets no-cache response headers", () => {
    const headers = noCacheHeaders();
    expect(headers["Cache-Control"]).toContain("no-store");
    expect(headers["Cache-Control"]).toContain("no-cache");
    expect(headers.Pragma).toBe("no-cache");
  });
});
