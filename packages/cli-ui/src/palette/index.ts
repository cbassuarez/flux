import path from "node:path";

export type PaletteGroup = "Commands" | "Docs" | "Templates" | "Files";

export type PaletteItem = {
  id: string;
  label: string;
  group: PaletteGroup;
  kind: "action" | "template" | "doc" | "file";
  payload?: any;
  hint?: string;
};

export function buildPaletteItems(options: {
  recents: { path: string }[];
  fluxFiles: string[];
  activeDoc?: string | null;
}) {
  const { recents, fluxFiles, activeDoc } = options;
  const items: PaletteItem[] = [];

  items.push({ id: "open", label: "Open document", group: "Commands", kind: "action", payload: { action: "open" } });
  items.push({ id: "new", label: "New document wizard", group: "Commands", kind: "action", payload: { action: "new" } });
  items.push({ id: "edit", label: "Edit current document", group: "Commands", kind: "action", payload: { action: "edit" } });
  items.push({ id: "export", label: "Export PDF", group: "Commands", kind: "action", payload: { action: "export" } });
  items.push({ id: "doctor", label: "Doctor (check)", group: "Commands", kind: "action", payload: { action: "doctor" } });
  items.push({ id: "format", label: "Format document", group: "Commands", kind: "action", payload: { action: "format" } });

  items.push({ id: "new-demo", label: "Template: demo", group: "Templates", kind: "template", payload: { template: "demo" } });
  items.push({ id: "new-article", label: "Template: article", group: "Templates", kind: "template", payload: { template: "article" } });
  items.push({ id: "new-spec", label: "Template: spec", group: "Templates", kind: "template", payload: { template: "spec" } });
  items.push({ id: "new-zine", label: "Template: zine", group: "Templates", kind: "template", payload: { template: "zine" } });
  items.push({ id: "new-paper", label: "Template: paper", group: "Templates", kind: "template", payload: { template: "paper" } });
  items.push({ id: "new-blank", label: "Template: blank", group: "Templates", kind: "template", payload: { template: "blank" } });

  if (activeDoc) {
    items.push({ id: `doc-${activeDoc}`, label: `Current: ${path.basename(activeDoc)}`, group: "Docs", kind: "doc", payload: { path: activeDoc } });
  }
  for (const entry of recents) {
    items.push({ id: `recent-${entry.path}`, label: `Recent: ${path.basename(entry.path)}`, group: "Docs", kind: "doc", payload: { path: entry.path } });
  }
  for (const file of fluxFiles) {
    items.push({ id: `file-${file}`, label: `File: ${path.basename(file)}`, group: "Files", kind: "file", payload: { path: file } });
  }

  return items;
}

export function filterPaletteItems(items: PaletteItem[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  return items
    .map((item) => {
      const score = fuzzyScore(q, item.label.toLowerCase());
      if (score === null) return null;
      return { item, score };
    })
    .filter((entry): entry is { item: PaletteItem; score: number } => entry !== null)
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.item);
}

export function groupPaletteItems(items: PaletteItem[]) {
  const order: PaletteGroup[] = ["Commands", "Docs", "Templates", "Files"];
  const grouped = new Map<PaletteGroup, PaletteItem[]>();
  for (const group of order) grouped.set(group, []);
  for (const item of items) {
    const bucket = grouped.get(item.group);
    if (bucket) bucket.push(item);
  }
  return order
    .map((group) => ({ group, items: grouped.get(group) ?? [] }))
    .filter((entry) => entry.items.length > 0);
}

function fuzzyScore(query: string, target: string): number | null {
  if (!query) return 0;
  let score = 0;
  let lastIndex = -1;
  let consecutive = 0;
  for (const ch of query) {
    const idx = target.indexOf(ch, lastIndex + 1);
    if (idx === -1) return null;
    if (idx === lastIndex + 1) {
      consecutive += 1;
      score -= 2 * consecutive;
    } else {
      consecutive = 0;
      score += idx - lastIndex - 1;
    }
    lastIndex = idx;
  }
  return score + (target.length - query.length);
}
