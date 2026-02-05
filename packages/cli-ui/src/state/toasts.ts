import { useCallback, useRef, useState } from "react";

export type ToastKind = "info" | "success" | "error";

export type Toast = {
  id: string;
  message: string;
  kind: ToastKind;
};

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback((message: string, kind: ToastKind = "info", ttl = 2500) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const toast: Toast = { id, message, kind };
    setToasts((prev) => [...prev.slice(-2), toast]);
    const timer = setTimeout(() => remove(id), ttl);
    timers.current.set(id, timer);
  }, [remove]);

  return { toasts, push, remove };
}
