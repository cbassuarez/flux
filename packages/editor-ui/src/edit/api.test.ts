import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, fetchEditState, resolveFileParam } from "./api";

describe("api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws ApiError with status and message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => "application/json" },
      json: async () => ({ message: "server down" }),
      text: async () => "server down"
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchEditState()).rejects.toMatchObject({ status: 500 });
    await fetchEditState().catch((error) => {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toContain("server down");
    });
  });
});

describe("resolveFileParam", () => {
  it("prefers search params", () => {
    expect(
      resolveFileParam({
        search: "?file=viewer-demo.flux",
        hash: "#/edit?file=hash.flux",
        referrer: "http://localhost:3000/edit?file=ref.flux",
        parentSearch: "?file=parent.flux",
        stored: "stored.flux"
      })
    ).toBe("viewer-demo.flux");
  });

  it("reads file from hash query string", () => {
    expect(
      resolveFileParam({
        search: "",
        hash: "#/edit?file=hash.flux"
      })
    ).toBe("hash.flux");
  });

  it("reads file from referrer", () => {
    expect(
      resolveFileParam({
        search: "",
        hash: "",
        referrer: "http://localhost:3000/edit?file=referrer.flux"
      })
    ).toBe("referrer.flux");
  });

  it("reads file from parent search", () => {
    expect(
      resolveFileParam({
        search: "",
        hash: "",
        parentSearch: "?file=parent.flux"
      })
    ).toBe("parent.flux");
  });

  it("falls back when referrer is invalid", () => {
    expect(
      resolveFileParam({
        search: "",
        hash: "",
        referrer: "not a url",
        stored: "stored.flux"
      })
    ).toBe("stored.flux");
  });

  it("returns stored value when nothing else matches", () => {
    expect(resolveFileParam({ stored: "stored.flux" })).toBe("stored.flux");
  });
});
