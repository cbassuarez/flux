import type { RenderDocumentIR } from "@flux-lang/core";
export declare function collectSlotHashes(ir: RenderDocumentIR): Map<string, string>;
export declare function diffSlotIds(prev: Map<string, string>, next: Map<string, string>): string[];
export declare function shrinkToFit(container: HTMLElement, inner: HTMLElement): number;
export declare function scaleDownToFit(container: HTMLElement, inner: HTMLElement): number;
//# sourceMappingURL=patching.d.ts.map