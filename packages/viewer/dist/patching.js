export function collectSlotHashes(ir) {
    const map = new Map();
    for (const node of ir.body) {
        collect(node, map);
    }
    return map;
}
export function diffSlotIds(prev, next) {
    const changed = [];
    for (const [id, hash] of next.entries()) {
        if (prev.get(id) !== hash)
            changed.push(id);
    }
    return changed;
}
export function shrinkToFit(container, inner) {
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
        }
        else {
            hi = mid - 0.1;
        }
    }
    inner.style.fontSize = `${best}px`;
    return best;
}
export function scaleDownToFit(container, inner) {
    inner.style.transformOrigin = "top left";
    const scaleX = container.clientWidth / inner.scrollWidth;
    const scaleY = container.clientHeight / inner.scrollHeight;
    const scale = Math.min(1, scaleX, scaleY);
    inner.style.transform = `scale(${scale})`;
    return scale;
}
function collect(node, map) {
    if (node.kind === "slot" || node.kind === "inline_slot") {
        map.set(node.nodeId, JSON.stringify(node));
    }
    for (const child of node.children ?? []) {
        collect(child, map);
    }
}
function fitsWithin(container, inner) {
    return inner.scrollWidth <= container.clientWidth && inner.scrollHeight <= container.clientHeight;
}
//# sourceMappingURL=patching.js.map