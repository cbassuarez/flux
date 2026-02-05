export declare function DashboardScreen({ width, activeDoc, backend, viewerStatus, streamOk, logs, logsOpen, onToggleLogs, actionItems, showEmptyState, onEmptyAction, debug, }: {
    width: number;
    activeDoc: string | null;
    backend: string;
    viewerStatus?: {
        docstep: number;
        time: number;
        seed: number;
    } | null;
    streamOk: boolean;
    logs: string[];
    logsOpen: boolean;
    onToggleLogs: () => void;
    actionItems: {
        id: string;
        label: string;
        icon?: string;
        onClick: () => void;
        active?: boolean;
    }[];
    showEmptyState: boolean;
    onEmptyAction: (action: "new" | "open") => void;
    debug?: boolean;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=DashboardScreen.d.ts.map