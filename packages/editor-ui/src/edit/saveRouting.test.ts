import { describe, expect, it, vi } from "vitest";
import { pickSourceForSave, routeSave } from "./saveRouting";

describe("pickSourceForSave", () => {
  it("chooses canonical doc source when source editor is not dirty", () => {
    const decision = pickSourceForSave({
      isSourceEditorDirty: false,
      sourceDraft: 'choose("alpha", "beta")',
      docSource: 'choose("alpha", "beta", "gamma", "delta")',
    });

    expect(decision).toEqual({
      mode: "persistDocSource",
      source: 'choose("alpha", "beta", "gamma", "delta")',
    });
  });

  it("chooses source draft when source editor is dirty", () => {
    const decision = pickSourceForSave({
      isSourceEditorDirty: true,
      sourceDraft: 'choose("alpha", "beta")',
      docSource: 'choose("alpha", "beta", "gamma", "delta")',
    });

    expect(decision).toEqual({
      mode: "applySource",
      source: 'choose("alpha", "beta")',
    });
  });
});

describe("routeSave regression", () => {
  it("persists doc.source when inspector changed source and sourceDraft is stale", async () => {
    const applySource = vi.fn();
    const persistDocSource = vi.fn();
    const staleSourceDraft = 'choose("alpha", "beta")';
    const updatedDocSource = 'choose("alpha", "beta", "gamma", "delta")';

    const decision = await routeSave(
      {
        isSourceEditorDirty: false,
        sourceDraft: staleSourceDraft,
        docSource: updatedDocSource,
      },
      { applySource, persistDocSource },
    );

    expect(decision).toEqual({ mode: "persistDocSource", source: updatedDocSource });
    expect(persistDocSource).toHaveBeenCalledTimes(1);
    expect(persistDocSource).toHaveBeenCalledWith(updatedDocSource);
    expect(applySource).not.toHaveBeenCalled();
  });
});
