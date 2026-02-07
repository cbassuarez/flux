import { useMemo } from "react";

type StagePaneProps = {
  previewPath?: string;
  revision?: number;
  onClearSelection: () => void;
};

function getFileParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("file");
}

function buildPreviewSrc(basePath?: string, revision?: number): string {
  if (typeof window === "undefined") return basePath ?? "/preview";
  const url = new URL(basePath ?? "/preview", window.location.origin);
  const file = getFileParam();
  if (file) url.searchParams.set("file", file);
  if (typeof revision === "number") url.searchParams.set("rev", String(revision));
  return `${url.pathname}${url.search}`;
}

export default function StagePane({ previewPath, revision, onClearSelection }: StagePaneProps) {
  const previewSrc = useMemo(() => buildPreviewSrc(previewPath, revision), [previewPath, revision]);

  return (
    <section className="page-stage" onClick={onClearSelection}>
      <div className="page-stage-inner">
        <div className="preview-wrap">
          <iframe
            title="Flux preview"
            className="preview-frame"
            src={previewSrc}
            style={{ pointerEvents: "none" }}
          />
        </div>
      </div>
    </section>
  );
}
