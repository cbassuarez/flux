import type { DocumentNode } from "@flux-lang/core";
import { extractPlainText, getLiteralString } from "../docModel";

export function formatNodeLabel(node: DocumentNode): string {
  try {
    if (node.kind === "page") {
      const title = getLiteralString(node.props?.title) ?? getLiteralString(node.props?.name);
      return title ?? `page ${node.id}`;
    }
    if (node.kind === "section") {
      const heading = node.children?.find((child) => child.kind === "text");
      const text = heading ? extractPlainText(heading).trim() : "";
      return text || `section ${node.id}`;
    }
    if (node.kind === "figure") {
      const label = getLiteralString(node.props?.label);
      return label ?? `figure ${node.id}`;
    }
    if (node.kind === "text") {
      const text = extractPlainText(node).trim();
      if (text) return text.length > 42 ? `${text.slice(0, 42)}…` : text;
    }
    const name = getLiteralString(node.props?.name);
    if (name) return name;
    return `${node.kind} ${node.id}`;
  } catch {
    return `${node.kind} ${node.id}`;
  }
}
