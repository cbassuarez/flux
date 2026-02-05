import { type CommandResult } from "../types.js";
export type AddKind = "title" | "page" | "section" | "figure" | "callout" | "table" | "slot" | "inline-slot" | "bibliography-stub";
export interface AddOptions {
    cwd: string;
    file: string;
    kind: AddKind;
    text?: string;
    heading?: string;
    label?: string;
    noHeading?: boolean;
    noCheck?: boolean;
}
export interface AddData {
    file: string;
    kind: AddKind;
}
export declare function addCommand(options: AddOptions): Promise<CommandResult<AddData>>;
//# sourceMappingURL=add.d.ts.map