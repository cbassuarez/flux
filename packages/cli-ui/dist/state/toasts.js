import { useCallback, useRef, useState } from "react";
export function useToasts() {
    const [toasts, setToasts] = useState([]);
    const timers = useRef(new Map());
    const remove = useCallback((id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
        const timer = timers.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timers.current.delete(id);
        }
    }, []);
    const push = useCallback((message, kind = "info", ttl = 2500) => {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const toast = { id, message, kind };
        setToasts((prev) => [...prev.slice(-2), toast]);
        const timer = setTimeout(() => remove(id), ttl);
        timers.current.set(id, timer);
    }, [remove]);
    return { toasts, push, remove };
}
//# sourceMappingURL=toasts.js.map