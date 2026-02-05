import type { FluxDocument } from "./ast.js";
export type SlotFitPolicy = "clip" | "ellipsis" | "shrink" | "scaleDown";
export type AddTransformKind = "title" | "page" | "section" | "figure" | "callout" | "table" | "slot" | "inline-slot" | "bibliography-stub";
export interface AddTransformOptions {
    kind: AddTransformKind;
    text?: string;
    heading?: string;
    label?: string;
    noHeading?: boolean;
    bankName?: string;
    tags?: string[];
    caption?: string;
    reserve?: string | {
        width: number;
        height?: number;
        units?: string;
    };
    fit?: SlotFitPolicy | string;
}
export declare function applyAddTransform(source: string, doc: FluxDocument, options: AddTransformOptions): string;
export declare function formatFluxSource(source: string): string;
//# sourceMappingURL=transform.d.ts.map