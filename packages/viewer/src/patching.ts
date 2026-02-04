import type { RenderDocumentIR, RenderNodeIR } from "@flux-lang/core";

export function collectSlotHashes(ir: RenderDocumentIR): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of ir.body) {
    collect(node, map);
  }
  return map;
}

export function diffSlotIds(prev: Map<string, string>, next: Map<string, string>): string[] {
  const changed: string[] = [];
  for (const [id, hash] of next.entries()) {
    if (prev.get(id) !== hash) changed.push(id);
  }
  return changed;
}

export function shrinkToFit(container: HTMLElement, inner: HTMLElement): number {
  const style = window.getComputedStyle(inner);
  const base = parseFloat(style.fontSize) || 14;
  let lo = 6;
  let hi = base;
  let best = base;
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    inner.style.fontSize = `${mid}px`;
    if (fitsWithin(container, inner)) {
      best = mid;
      lo = mid + 0.1;
    } else {
      hi = mid - 0.1;
    }
  }
  inner.style.fontSize = `${best}px`;
  return best;
}

export function scaleDownToFit(container: HTMLElement, inner: HTMLElement): number {
  inner.style.transformOrigin = "top left";
  const scaleX = container.clientWidth / inner.scrollWidth;
  const scaleY = container.clientHeight / inner.scrollHeight;
  const scale = Math.min(1, scaleX, scaleY);
  inner.style.transform = `scale(${scale})`;
  return scale;
}

export function applySlotPatches(
  root: { querySelector: (selector: string) => Element | null },
  slotPatches: Record<string, string>,
): string[] {
  const missing: string[] = [];
  for (const [id, html] of Object.entries(slotPatches)) {
    const selector = `[data-flux-id="${escapeSelector(id)}"]`;
    const slot = root.querySelector(selector);
    if (!slot) {
      missing.push(id);
      continue;
    }
    const inner =
      slot.querySelector("[data-flux-slot-inner]") || slot.querySelector(".flux-slot-inner") || slot;
    (inner as HTMLElement).innerHTML = html ?? "";
  }
  return missing;
}

function collect(node: RenderNodeIR, map: Map<string, string>): void {
  if (node.kind === "slot" || node.kind === "inline_slot") {
    map.set(node.nodeId, JSON.stringify(node));
  }
  for (const child of node.children ?? []) {
    collect(child, map);
  }
}

function fitsWithin(container: HTMLElement, inner: HTMLElement): boolean {
  return inner.scrollWidth <= container.clientWidth && inner.scrollHeight <= container.clientHeight;
}

function escapeSelector(value: string): string {
  const css = (globalThis as any).CSS;
  if (css && typeof css.escape === "function") return css.escape(value);
  return value.replace(/[\"\\\\]/g, "\\\\$&");
}
