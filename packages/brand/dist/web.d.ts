import { type FluxVersionInfo } from "./index.js";
export declare const FLUX_MARK_FAVICON_PATH = "/flux-mark-favicon.svg";
export type FluxMarkRenderMode = "mono" | "color";
export type FluxMarkProps = {
    size?: number;
    markPath?: string;
    renderMode?: FluxMarkRenderMode;
    className?: string;
    title?: string;
    testId?: string;
};
export declare function FluxMark({ size, markPath, renderMode, className, title, testId, }: FluxMarkProps): import("react/jsx-runtime").JSX.Element;
export type FluxWordmarkProps = {
    className?: string;
};
export declare function FluxWordmark({ className }: FluxWordmarkProps): import("react/jsx-runtime").JSX.Element;
export type FluxBrandHeaderVariant = "menu" | "marketing" | "header";
export type FluxBrandHeaderProps = {
    info: Partial<FluxVersionInfo>;
    variant?: FluxBrandHeaderVariant;
    markPath?: string;
    markRenderMode?: FluxMarkRenderMode;
    showTagline?: boolean;
    onVersionClick?: () => void;
    className?: string;
    line1ClassName?: string;
    line2ClassName?: string;
    title?: string;
};
export declare function FluxBrandHeader({ info, variant, markPath, markRenderMode, showTagline, onVersionClick, className, line1ClassName, line2ClassName, title, }: FluxBrandHeaderProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=web.d.ts.map