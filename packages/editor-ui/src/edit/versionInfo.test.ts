import { describe, expect, it, vi } from "vitest";
import { FLUX_TAGLINE } from "@flux-lang/brand";
import { getFluxVersionInfo } from "./versionInfo";

describe("getFluxVersionInfo", () => {
  it("prefers /api/version in dev with cache busting", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ version: "0.9.9", channel: "canary" }),
    });

    const info = await getFluxVersionInfo({
      dev: true,
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => 1234,
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/version?t=1234", { cache: "no-store" });
    expect(info.version).toBe("0.9.9");
    expect(info.channel).toBe("canary");
    expect(info.tagline).toBe(FLUX_TAGLINE);
  });

  it("uses injected build-time info in non-dev mode", async () => {
    const fetchMock = vi.fn();
    const info = await getFluxVersionInfo({
      dev: false,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(info.version).toBeTruthy();
    expect(info.tagline).toBe(FLUX_TAGLINE);
  });

  it("falls back safely when dev fetch fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));

    const info = await getFluxVersionInfo({
      dev: true,
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => 42,
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/version?t=42", { cache: "no-store" });
    expect(info.version).toBeTruthy();
    expect(info.tagline).toBe(FLUX_TAGLINE);
  });
});
