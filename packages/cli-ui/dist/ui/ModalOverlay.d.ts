import React from "react";
export declare const MODAL_MARGIN = 2;
export declare const MODAL_MIN_WIDTH = 52;
export declare const MODAL_MAX_WIDTH = 96;
export declare const MODAL_MIN_HEIGHT = 12;
export declare const MODAL_MAX_HEIGHT = 24;
export declare const MODAL_PADDING_X = 2;
export declare const MODAL_PADDING_Y = 1;
export declare const MODAL_BORDER_WIDTH = 1;
type ModalLayoutInput = {
    columns: number;
    rows: number;
    width?: number | "auto";
    height?: number | "auto";
};
export type ModalLayout = {
    width: number;
    height: number;
    left: number;
    top: number;
    contentWidth: number;
    contentHeight: number;
};
export declare function buildFillLines(width: number, height: number): string;
export declare function getModalLayout({ columns, rows, width, height }: ModalLayoutInput): ModalLayout;
export declare function ModalOverlay({ isOpen, title, subtitle, width, height, onRequestClose, children, footer, }: {
    isOpen: boolean;
    title: string;
    subtitle?: string;
    width?: number | "auto";
    height?: number | "auto";
    onRequestClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element | null;
export {};
//# sourceMappingURL=ModalOverlay.d.ts.map