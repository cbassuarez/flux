import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, fetchEditState } from "./api";

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
