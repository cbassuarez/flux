import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DocIndexEntry, EditorTransform } from "../docService";
import { createDocService } from "../docService";
import { useDocState } from "./useDocState";
import TopBar from "./TopBar";
import OutlinePane from "./OutlinePane";
import StagePane from "./StagePane";
import InspectorPane from "./InspectorPane";

export default function EditorRoot() {
  const serviceRef = useRef(createDocService());
  const docService = serviceRef.current;
  const docState = useDocState(docService);
  const [transformError, setTransformError] = useState<string | null>(null);

  useEffect(() => {
    void docService.loadDoc();
  }, [docService]);

  const selectedEntry: DocIndexEntry | null = useMemo(() => {
    const selectedId = docState.selection.id;
    if (!selectedId) return null;
    return docState.doc?.index?.get(selectedId) ?? null;
  }, [docState.doc?.index, docState.selection.id]);

  const applyTransform = useCallback(
    async (transform: EditorTransform) => {
      const result = await docService.applyTransform(transform);
      if (!result.ok) {
        setTransformError(result.error ?? "Transform failed");
      } else {
        setTransformError(null);
      }
    },
    [docService],
  );

  const handleSelect = useCallback(
    (id: string, kind: string) => {
      docService.setSelection(id, kind);
    },
    [docService],
  );

  const handleClearSelection = useCallback(() => {
    docService.setSelection(null);
  }, [docService]);

  const handleReload = useCallback(() => {
    void docService.loadDoc();
  }, [docService]);

  const handleSave = useCallback(() => {
    if (!docState.doc?.source) return;
    void docService.saveDoc(docState.doc.source);
  }, [docService, docState.doc?.source]);

  const handleUndo = useCallback(() => {
    void docService.undo();
  }, [docService]);

  const handleRedo = useCallback(() => {
    void docService.redo();
  }, [docService]);

  const docTitle = docState.doc?.title ?? null;
  const docPath = docState.doc?.docPath ?? null;
  const previewPath = docState.doc?.previewPath;
  const previewRevision = docState.doc?.revision;
  const docError = docState.error ?? (docState.status === "error" ? "Failed to load document." : null);

  return (
    <div className="editor-root">
      <div className="editor-shell">
        <TopBar
          docTitle={docTitle}
          docPath={docPath}
          docState={docState}
          onReload={handleReload}
          onSave={handleSave}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />
        {docError ? <div className="editor-error-banner">{docError}</div> : null}
        <div className="editor-body">
          <OutlinePane doc={docState.doc?.ast ?? null} selectedId={docState.selection.id} onSelect={handleSelect} />
          <StagePane previewPath={previewPath} revision={previewRevision} onClearSelection={handleClearSelection} />
          <InspectorPane selectedEntry={selectedEntry} onApplyTransform={applyTransform} transformError={transformError} />
        </div>
      </div>
    </div>
  );
}
