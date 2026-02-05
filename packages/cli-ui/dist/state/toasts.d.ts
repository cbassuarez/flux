export type ToastKind = "info" | "success" | "error";
export type Toast = {
    id: string;
    message: string;
    kind: ToastKind;
};
export declare function useToasts(): {
    toasts: Toast[];
    push: (message: string, kind?: ToastKind, ttl?: number) => void;
    remove: (id: string) => void;
};
//# sourceMappingURL=toasts.d.ts.map