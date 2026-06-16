export type SaveSourceMode = "applySource" | "persistDocSource";

export type SaveSourceDecision = {
  mode: SaveSourceMode;
  source: string;
};

export type PickSourceForSaveInput = {
  isSourceEditorDirty: boolean;
  sourceDraft: string;
  docSource: string;
};

export function pickSourceForSave(input: PickSourceForSaveInput): SaveSourceDecision {
  if (input.isSourceEditorDirty) {
    return { mode: "applySource", source: input.sourceDraft };
  }
  return { mode: "persistDocSource", source: input.docSource };
}

export type SaveRouteHandlers = {
  applySource: (source: string) => Promise<void> | void;
  persistDocSource: (source: string) => Promise<void> | void;
};

export async function routeSave(input: PickSourceForSaveInput, handlers: SaveRouteHandlers): Promise<SaveSourceDecision> {
  const decision = pickSourceForSave(input);
  if (decision.mode === "applySource") {
    await handlers.applySource(decision.source);
  } else {
    await handlers.persistDocSource(decision.source);
  }
  return decision;
}
