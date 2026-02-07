import type { DocumentNode, FluxDocument } from "@flux-lang/core";
import { formatNodeLabel } from "./formatNodeLabel";

type OutlinePaneProps = {
  doc: FluxDocument | null;
  selectedId: string | null;
  onSelect: (id: string, kind: string) => void;
};

type OutlineItem = {
  id: string;
  kind: string;
  label: string;
  children: OutlineItem[];
};

function buildOutline(nodes: DocumentNode[]): OutlineItem[] {
  return nodes.map((node) => ({
    id: node.id,
    kind: node.kind,
    label: formatNodeLabel(node),
    children: buildOutline(node.children ?? []),
  }));
}

function OutlineNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: OutlineItem;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string, kind: string) => void;
}) {
  const isSelected = selectedId === node.id;
  return (
    <div className="outline-item">
      <button
        type="button"
        className={`outline-btn ${isSelected ? "is-selected" : ""}`}
        style={{ paddingLeft: 12 + depth * 14 }}
        onClick={() => onSelect(node.id, node.kind)}
      >
        <span className="outline-kind">{node.kind}</span>
        <span className="outline-label">{node.label}</span>
      </button>
      {node.children.length ? (
        <div className="outline-children">
          {node.children.map((child) => (
            <OutlineNode key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function OutlinePane({ doc, selectedId, onSelect }: OutlinePaneProps) {
  const outline = doc?.body?.nodes ? buildOutline(doc.body.nodes) : [];

  return (
    <aside className="outline-pane">
      <div className="outline-tree">
        {outline.length ? (
          outline.map((node) => (
            <OutlineNode key={node.id} node={node} depth={0} selectedId={selectedId} onSelect={onSelect} />
          ))
        ) : (
          <div className="outline-empty">No nodes in this document.</div>
        )}
      </div>
    </aside>
  );
}
