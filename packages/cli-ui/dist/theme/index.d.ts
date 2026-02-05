export declare const isTruecolor: boolean;
export declare const color: {
    fg: string;
    muted: string;
    border: string;
    panel: string;
    panelAlt: string;
    danger: string;
};
export declare function accent(text: string): string;
export declare function accentRule(width: number): string;
export declare function mutedRuleText(width: number): string;
export declare function truncateMiddle(value: string, max: number): string;
export declare const spacing: {
    xs: number;
    sm: number;
    md: number;
};
export declare const theme: {
    color: {
        fg: string;
        muted: string;
        border: string;
        panel: string;
        panelAlt: string;
        danger: string;
    };
    isTruecolor: boolean;
    spacing: {
        xs: number;
        sm: number;
        md: number;
    };
    accent: typeof accent;
    accentRule: typeof accentRule;
    truncateMiddle: typeof truncateMiddle;
};
//# sourceMappingURL=index.d.ts.map