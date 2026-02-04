import { describe, it, expect } from "vitest";
import { shouldLaunchUi } from "../src/ui-routing.js";

describe("UI routing", () => {
  it("launches UI for TTY when no opt-out flags are present", () => {
    const result = shouldLaunchUi({
      stdoutIsTTY: true,
      stdinIsTTY: true,
      json: false,
      noUi: false,
      env: {},
    });
    expect(result).toBe(true);
  });

  it("disables UI when stdout is not TTY", () => {
    const result = shouldLaunchUi({
      stdoutIsTTY: false,
      stdinIsTTY: true,
      json: false,
      noUi: false,
      env: {},
    });
    expect(result).toBe(false);
  });

  it("disables UI when --json is present", () => {
    const result = shouldLaunchUi({
      stdoutIsTTY: true,
      stdinIsTTY: true,
      json: true,
      noUi: false,
      env: {},
    });
    expect(result).toBe(false);
  });

  it("disables UI when --no-ui is present", () => {
    const result = shouldLaunchUi({
      stdoutIsTTY: true,
      stdinIsTTY: true,
      json: false,
      noUi: true,
      env: {},
    });
    expect(result).toBe(false);
  });

  it("disables UI when FLUX_NO_UI=1", () => {
    const result = shouldLaunchUi({
      stdoutIsTTY: true,
      stdinIsTTY: true,
      json: false,
      noUi: false,
      env: { FLUX_NO_UI: "1" },
    });
    expect(result).toBe(false);
  });
});
