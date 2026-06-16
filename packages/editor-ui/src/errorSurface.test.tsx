import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AppErrorBoundary } from "./errorSurface";

function Boom(): JSX.Element {
  throw new Error("kaboom in render");
}

describe("AppErrorBoundary", () => {
  it("renders children normally when nothing throws", () => {
    render(
      <AppErrorBoundary>
        <div>healthy content</div>
      </AppErrorBoundary>,
    );
    expect(screen.getByText("healthy content")).toBeTruthy();
  });

  it("shows a visible, recoverable error UI instead of a blank screen", () => {
    // React logs the caught error; silence it for a clean test run.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(
        <AppErrorBoundary>
          <Boom />
        </AppErrorBoundary>,
      );
    } finally {
      spy.mockRestore();
    }

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/unexpected error/i)).toBeTruthy();
    expect(screen.getByText("kaboom in render")).toBeTruthy();
    expect(screen.getByRole("button", { name: /reload editor/i })).toBeTruthy();
  });
});
