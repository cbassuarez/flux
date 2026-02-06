export type ImageFrame = {
  fit: "contain" | "cover";
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type SlotPatch =
  | { kind: "text"; text: string }
  | { kind: "asset"; src: string; alt?: string };

const SLOT_INNER_ATTR = "data-flux-slot-inner";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeSelector(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
}

export function sanitizeSlotText(value: string): string {
  return value.replace(/[\r\n]+/g, " ");
}

export function findFluxElement(doc: Document, id: string): HTMLElement | null {
  const escaped = escapeSelector(id);
  return (
    doc.querySelector(`[data-flux-id=\"${escaped}\"]`) ||
    doc.querySelector(`[data-flux-node=\"${escaped}\"]`)
  ) as HTMLElement | null;
}

export function ensureFluxAttributes(el: HTMLElement, id?: string, kind?: string) {
  if (id && !el.getAttribute("data-flux-id")) {
    el.setAttribute("data-flux-id", id);
  }
  if (kind && !el.getAttribute("data-flux-kind")) {
    el.setAttribute("data-flux-kind", kind);
  }
}

export function normalizeInlineSlotOuter(el: HTMLElement): HTMLElement {
  if (el.tagName === "SPAN") return el;
  const doc = el.ownerDocument;
  const replacement = doc.createElement("span");
  Array.from(el.attributes).forEach((attr) => replacement.setAttribute(attr.name, attr.value));
  while (el.firstChild) {
    replacement.appendChild(el.firstChild);
  }
  el.replaceWith(replacement);
  return replacement;
}

export function ensureSlotInnerWrapper(outer: HTMLElement, inline: boolean): HTMLElement {
  const doc = outer.ownerDocument;
  let inner = outer.querySelector<HTMLElement>(`[${SLOT_INNER_ATTR}]`);
  if (!inner) {
    inner = doc.createElement(inline ? "span" : "div");
    inner.setAttribute(SLOT_INNER_ATTR, "");
    outer.appendChild(inner);
  }

  inner.classList.add("flux-slot-inner");

  if (inline && inner.tagName !== "SPAN") {
    const replacement = doc.createElement("span");
    replacement.setAttribute(SLOT_INNER_ATTR, "");
    Array.from(inner.attributes).forEach((attr) => {
      if (attr.name !== SLOT_INNER_ATTR) replacement.setAttribute(attr.name, attr.value);
    });
    while (inner.firstChild) {
      replacement.appendChild(inner.firstChild);
    }
    inner.replaceWith(replacement);
    inner = replacement;
  }

  const nodes = Array.from(outer.childNodes).filter((node) => node !== inner);
  for (const node of nodes) {
    inner.appendChild(node);
  }

  return inner;
}

export function patchSlotText(outer: HTMLElement, text: string, inline: boolean): HTMLElement {
  const targetOuter = inline ? normalizeInlineSlotOuter(outer) : outer;
  const inner = ensureSlotInnerWrapper(targetOuter, inline);
  inner.innerHTML = escapeHtml(text);
  return targetOuter;
}

function renderSlotPatch(container: HTMLElement, patch: SlotPatch) {
  const doc = container.ownerDocument;
  container.innerHTML = "";
  if (patch.kind === "text") {
    container.textContent = patch.text;
    return;
  }
  if (!patch.src) return;
  const img = doc.createElement("img");
  img.src = patch.src;
  img.alt = patch.alt ?? "";
  img.className = "flux-slot-asset";
  container.appendChild(img);
}

export function patchSlotContent(outer: HTMLElement, patch: SlotPatch, inline: boolean): HTMLElement {
  const targetOuter = inline ? normalizeInlineSlotOuter(outer) : outer;
  const inner = ensureSlotInnerWrapper(targetOuter, inline);
  if (patch.kind === "text") {
    inner.innerHTML = escapeHtml(patch.text);
    return targetOuter;
  }
  renderSlotPatch(inner, patch);
  return targetOuter;
}

export function clearSlotTransitionLayers(outer: HTMLElement) {
  const inner = outer.querySelector<HTMLElement>(`[${SLOT_INNER_ATTR}]`);
  const doc = outer.ownerDocument;
  const win = doc?.defaultView;
  outer.classList.remove("flux-slot-transitioning");
  outer.querySelectorAll("[data-flux-slot-transition-layer]").forEach((layer) => layer.remove());
  if (!inner) return;

  const timeoutId = inner.dataset.fluxTransitionTimeout;
  if (timeoutId && win) {
    win.clearTimeout(Number(timeoutId));
  }
  delete inner.dataset.fluxTransitionTimeout;

  const restore = (key: string, styleProp: keyof CSSStyleDeclaration) => {
    const value = inner.dataset[key];
    if (value === undefined) return;
    (inner.style as any)[styleProp] = value;
    delete inner.dataset[key];
  };

  restore("fluxPrevPosition", "position");
  restore("fluxPrevOverflow", "overflow");
  restore("fluxPrevMinWidth", "minWidth");
  restore("fluxPrevMinHeight", "minHeight");
}

export function patchSlotContentWithTransition(
  outer: HTMLElement,
  patch: SlotPatch,
  inline: boolean,
  transition: { kind: string; durationMs?: number; ease?: string; direction?: string } | null | undefined,
  options?: { reducedMotion?: boolean },
): void {
  if (!transition || transition.kind === "none" || transition.kind === "appear" || options?.reducedMotion) {
    patchSlotContent(outer, patch, inline);
    return;
  }

  const durationMs = Math.max(0, Number(transition.durationMs ?? 0));
  if (!durationMs) {
    patchSlotContent(outer, patch, inline);
    return;
  }

  const targetOuter = inline ? normalizeInlineSlotOuter(outer) : outer;
  const inner = ensureSlotInnerWrapper(targetOuter, inline);
  const doc = outer.ownerDocument;
  const win = doc?.defaultView;
  if (!doc || !win) {
    patchSlotContent(targetOuter, patch, inline);
    return;
  }

  clearSlotTransitionLayers(targetOuter);
  targetOuter.classList.add("flux-slot-transitioning");

  inner.dataset.fluxPrevPosition = inner.style.position;
  inner.dataset.fluxPrevOverflow = inner.style.overflow;
  inner.dataset.fluxPrevMinWidth = inner.style.minWidth;
  inner.dataset.fluxPrevMinHeight = inner.style.minHeight;

  if (!inner.style.position) inner.style.position = "relative";
  inner.style.overflow = "hidden";

  const rect = inner.getBoundingClientRect();
  if (rect.width > 0) inner.style.minWidth = `${rect.width}px`;
  if (rect.height > 0) inner.style.minHeight = `${rect.height}px`;

  const layer = doc.createElement(inline ? "span" : "div");
  layer.className = "flux-slot-transition-layer";
  layer.setAttribute("data-flux-slot-transition-layer", "true");

  const fromLayer = doc.createElement(inline ? "span" : "div");
  fromLayer.className = "flux-slot-layer flux-slot-layer-from";
  fromLayer.innerHTML = inner.innerHTML;

  const toLayer = doc.createElement(inline ? "span" : "div");
  toLayer.className = "flux-slot-layer flux-slot-layer-to";
  renderSlotPatch(toLayer, patch);

  layer.appendChild(fromLayer);
  layer.appendChild(toLayer);
  inner.innerHTML = "";
  inner.appendChild(layer);

  const easing = resolveEase(transition.ease);
  const animations: Animation[] = [];

  if (transition.kind === "fade") {
    animations.push(fromLayer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: durationMs, easing, fill: "forwards" }));
    animations.push(toLayer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: durationMs, easing, fill: "forwards" }));
  } else if (transition.kind === "wipe") {
    const clipFrom = wipeClipFrom(String(transition.direction ?? "right"));
    animations.push(fromLayer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: durationMs, easing, fill: "forwards" }));
    animations.push(
      toLayer.animate([
        { clipPath: clipFrom },
        { clipPath: "inset(0 0 0 0)" },
      ], { duration: durationMs, easing, fill: "forwards" }),
    );
  } else if (transition.kind === "flash") {
    animations.push(
      fromLayer.animate([
        { opacity: 1 },
        { opacity: 0.4 },
        { opacity: 0 },
      ], { duration: durationMs, easing: "linear", fill: "forwards" }),
    );
    animations.push(
      toLayer.animate([
        { opacity: 0 },
        { opacity: 1 },
      ], { duration: durationMs, easing: "linear", fill: "forwards" }),
    );
  } else {
    patchSlotContent(targetOuter, patch, inline);
    return;
  }

  const finalize = () => {
    clearSlotTransitionLayers(targetOuter);
    patchSlotContent(targetOuter, patch, inline);
  };

  const timeout = win.setTimeout(finalize, durationMs + 30);
  inner.dataset.fluxTransitionTimeout = String(timeout);

  animations.forEach((animation) => {
    animation.onfinish = () => {
      if (inner.dataset.fluxTransitionTimeout) return;
      finalize();
    };
  });
}

function resolveEase(ease?: string): string {
  switch (ease) {
    case "in":
      return "cubic-bezier(0.42, 0, 1, 1)";
    case "out":
      return "cubic-bezier(0, 0, 0.58, 1)";
    case "inOut":
      return "cubic-bezier(0.42, 0, 0.58, 1)";
    case "linear":
    default:
      return "linear";
  }
}

function wipeClipFrom(direction: string): string {
  switch (direction) {
    case "left":
      return "inset(0 0 0 100%)";
    case "right":
      return "inset(0 100% 0 0)";
    case "up":
      return "inset(100% 0 0 0)";
    case "down":
      return "inset(0 0 100% 0)";
    default:
      return "inset(0 100% 0 0)";
  }
}

export function ensurePreviewStyle(doc: Document) {
  if (doc.getElementById("flux-editor-preview-style")) return;
  const style = doc.createElement("style");
  style.id = "flux-editor-preview-style";
  style.textContent = `

    .flux-editor-show-ids [data-flux-id][data-flux-kind="page"],
    .flux-editor-show-ids [data-flux-id][data-flux-kind="section"],
    .flux-editor-show-ids [data-flux-id][data-flux-kind="figure"],
    .flux-editor-show-ids [data-flux-id][data-flux-kind="callout"],
    .flux-editor-show-ids [data-flux-id][data-flux-kind="table"],
    .flux-editor-show-ids [data-flux-id][data-flux-kind="slot"],
    .flux-editor-show-ids [data-flux-id][data-flux-slot="true"] {
      position: relative;
    }

    .flux-editor-show-ids [data-flux-id][data-flux-kind="page"][data-flux-selected="true"],
    .flux-editor-show-ids [data-flux-id][data-flux-kind="section"][data-flux-selected="true"],
    .flux-editor-show-ids [data-flux-id][data-flux-kind="figure"][data-flux-selected="true"],
    .flux-editor-show-ids [data-flux-id][data-flux-kind="callout"][data-flux-selected="true"],
    .flux-editor-show-ids [data-flux-id][data-flux-kind="table"][data-flux-selected="true"],
    .flux-editor-show-ids [data-flux-id][data-flux-kind="slot"][data-flux-selected="true"],
    .flux-editor-show-ids [data-flux-id][data-flux-slot="true"][data-flux-selected="true"] {
      outline: 2px solid rgba(31, 200, 183, 0.7);
      outline-offset: 2px;
    }

    .flux-editor-show-ids [data-flux-id][data-flux-kind="page"][data-flux-hovered="true"],
    .flux-editor-show-ids [data-flux-id][data-flux-kind="section"][data-flux-hovered="true"],
    .flux-editor-show-ids [data-flux-id][data-flux-kind="figure"][data-flux-hovered="true"],
    .flux-editor-show-ids [data-flux-id][data-flux-kind="callout"][data-flux-hovered="true"],
    .flux-editor-show-ids [data-flux-id][data-flux-kind="table"][data-flux-hovered="true"],
    .flux-editor-show-ids [data-flux-id][data-flux-kind="slot"][data-flux-hovered="true"],
    .flux-editor-show-ids [data-flux-id][data-flux-slot="true"][data-flux-hovered="true"] {
      outline: 1px solid rgba(31, 200, 183, 0.45);
      outline-offset: 2px;
    }

    .flux-editor-show-ids [data-flux-id][data-flux-kind="page"][data-flux-selected="true"]::after,
    .flux-editor-show-ids [data-flux-id][data-flux-kind="section"][data-flux-selected="true"]::after,
    .flux-editor-show-ids [data-flux-id][data-flux-kind="figure"][data-flux-selected="true"]::after,
    .flux-editor-show-ids [data-flux-id][data-flux-kind="callout"][data-flux-selected="true"]::after,
    .flux-editor-show-ids [data-flux-id][data-flux-kind="table"][data-flux-selected="true"]::after,
    .flux-editor-show-ids [data-flux-id][data-flux-kind="slot"][data-flux-selected="true"]::after,
    .flux-editor-show-ids [data-flux-id][data-flux-kind="page"][data-flux-hovered="true"]::after,
    .flux-editor-show-ids [data-flux-id][data-flux-kind="section"][data-flux-hovered="true"]::after,
    .flux-editor-show-ids [data-flux-id][data-flux-kind="figure"][data-flux-hovered="true"]::after,
    .flux-editor-show-ids [data-flux-id][data-flux-kind="callout"][data-flux-hovered="true"]::after,
    .flux-editor-show-ids [data-flux-id][data-flux-kind="table"][data-flux-hovered="true"]::after,
    .flux-editor-show-ids [data-flux-id][data-flux-kind="slot"][data-flux-hovered="true"]::after,
    .flux-editor-show-ids [data-flux-id][data-flux-slot="true"]::after {
      content: attr(data-flux-id);
      position: absolute;
      top: -14px;
      left: 0;
      padding: 2px 6px;
      border-radius: 8px;
      font-size: 10px;
      line-height: 1;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      color: #0f172a;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.16);
      pointer-events: none;
      z-index: 40;
      white-space: nowrap;
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .flux-editor-show-ids [data-flux-id][data-flux-slot="true"]::after {
      background: rgba(31, 200, 183, 0.12);
      color: #0f172a;
    }

    .flux-editor-adjust-image [data-flux-frame-target="true"] {
      cursor: grab;
    }

    .flux-editor-adjust-image [data-flux-frame-target="true"]:active {
      cursor: grabbing;
    }

    .flux-slot-inner {
      position: relative;
    }

    .flux-slot-asset {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .flux-slot-transition-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      display: block;
      z-index: 2;
    }

    .flux-slot-layer {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
    }
  `;
  doc.head.appendChild(style);
}

export function setPreviewRootClass(doc: Document, className: string, enabled: boolean) {
  const root = doc.documentElement;
  root.classList.toggle(className, enabled);
}

export function applyImageFrame(element: HTMLElement, frame: ImageFrame) {
  const target = element.tagName === "IMG" ? (element as HTMLImageElement) : element.querySelector("img");
  if (!target) return;
  target.style.setProperty("--flux-frame-ox", `${frame.offsetX}px`);
  target.style.setProperty("--flux-frame-oy", `${frame.offsetY}px`);
  target.style.setProperty("--flux-frame-scale", `${frame.scale}`);
  target.style.objectFit = frame.fit;
  target.style.transform = "translate(var(--flux-frame-ox), var(--flux-frame-oy)) scale(var(--flux-frame-scale))";
  target.style.transformOrigin = "center";
  target.style.willChange = "transform";
  (target as HTMLElement).setAttribute("data-flux-frame-target", "true");
}
