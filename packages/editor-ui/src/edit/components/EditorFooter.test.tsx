// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditorFooter } from "./EditorFooter";

describe("EditorFooter", () => {
  it("renders core context and diagnostics summary", () => {
    render(
      <EditorFooter
        docTitle="Product Brief"
        docPath="/docs/product.flux"
        saveState="saved"
        modeLabel="Edit"
        breadcrumb="Page 1 › Hero"
        diagnosticsSummary={{ errors: 2, warnings: 1 }}
        onOpenDiagnostics={vi.fn()}
      />,
    );

    expect(screen.getByText("Product Brief")).toBeTruthy();
    expect(screen.getByText("/docs/product.flux")).toBeTruthy();
    expect(screen.getByText("Edit")).toBeTruthy();
    expect(screen.getByText("Errors 2")).toBeTruthy();
    expect(screen.getByText("Warnings 1")).toBeTruthy();
  });

  it("shows playback readout when provided", () => {
    render(
      <EditorFooter
        docTitle="Playback Doc"
        saveState="dirty"
        modeLabel="Playback"
        breadcrumb="Page 2 › Footer"
        playbackReadout="Step 12 • t=3.4s"
        diagnosticsSummary={{ errors: 0, warnings: 0 }}
        onOpenDiagnostics={vi.fn()}
      />,
    );

    expect(screen.getByText("Step 12 • t=3.4s")).toBeTruthy();
    expect(screen.getByText("Page 2 › Footer")).toBeTruthy();
  });

  it("opens diagnostics from the summary", () => {
    const onOpenDiagnostics = vi.fn();
    render(
      <EditorFooter
        docTitle="Diagnostics Doc"
        saveState="error"
        modeLabel="Preview"
        diagnosticsSummary={{ errors: 1, warnings: 0 }}
        onOpenDiagnostics={onOpenDiagnostics}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /open diagnostics/i }));
    expect(onOpenDiagnostics).toHaveBeenCalledTimes(1);
  });
});
