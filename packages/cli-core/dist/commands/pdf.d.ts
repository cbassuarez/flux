import { type CommandResult } from "../types.js";
export interface PdfOptions {
    file: string;
    outPath: string;
    seed?: number;
    docstep?: number;
}
export interface PdfData {
    outPath: string;
    bytes: number;
}
export declare function pdfCommand(options: PdfOptions): Promise<CommandResult<PdfData>>;
//# sourceMappingURL=pdf.d.ts.map