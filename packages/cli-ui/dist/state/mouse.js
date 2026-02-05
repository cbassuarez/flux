import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { measureElement } from "ink";
const MouseContext = createContext(null);
export function MouseProvider({ children, disabled }) {
    const regionsRef = useRef(new Map());
    const register = useCallback((region) => {
        regionsRef.current.set(region.id, region);
    }, []);
    const unregister = useCallback((id) => {
        regionsRef.current.delete(id);
    }, []);
    useEffect(() => {
        if (disabled)
            return;
        const stdout = process.stdout;
        if (!stdout?.isTTY)
            return;
        stdout.write("\u001b[?1000h\u001b[?1006h");
        return () => {
            stdout.write("\u001b[?1000l\u001b[?1006l");
        };
    }, [disabled]);
    useEffect(() => {
        if (disabled)
            return;
        const stdin = process.stdin;
        if (!stdin?.on || !stdin.isTTY)
            return;
        const handleData = (data) => {
            const input = data.toString("utf8");
            const events = parseMouseSequences(input);
            for (const event of events) {
                if (!event.pressed || event.button !== 0)
                    continue;
                const x = event.x - 1;
                const y = event.y - 1;
                const matches = Array.from(regionsRef.current.values()).filter((region) => {
                    const withinX = x >= region.bounds.x && x < region.bounds.x + region.bounds.width;
                    const withinY = y >= region.bounds.y && y < region.bounds.y + region.bounds.height;
                    return withinX && withinY;
                });
                if (matches.length === 0)
                    continue;
                matches.sort((a, b) => {
                    if (b.priority !== a.priority)
                        return b.priority - a.priority;
                    const areaA = a.bounds.width * a.bounds.height;
                    const areaB = b.bounds.width * b.bounds.height;
                    return areaA - areaB;
                });
                matches[0]?.onClick();
            }
        };
        stdin.on("data", handleData);
        return () => {
            stdin.off("data", handleData);
        };
    }, [disabled]);
    return (_jsx(MouseContext.Provider, { value: { register, unregister }, children: children }));
}
export function useMouseRegion(id, onClick, priority = 0) {
    const ctx = useContext(MouseContext);
    const ref = useRef(null);
    useEffect(() => {
        if (!ctx || !ref.current)
            return;
        try {
            const bounds = measureElement(ref.current);
            ctx.register({ id, bounds, onClick, priority });
            return () => ctx.unregister(id);
        }
        catch {
            return;
        }
    });
    return ref;
}
function parseMouseSequences(input) {
    const events = [];
    const regex = /\u001b\[<(\d+);(\d+);(\d+)([mM])/g;
    let match;
    while ((match = regex.exec(input)) !== null) {
        const buttonCode = Number(match[1]);
        const x = Number(match[2]);
        const y = Number(match[3]);
        const pressed = match[4] === "M";
        const isScroll = buttonCode >= 64;
        const isMove = (buttonCode & 32) === 32;
        if (isScroll || isMove)
            continue;
        const button = buttonCode & 3;
        events.push({ button, x, y, pressed });
    }
    return events;
}
//# sourceMappingURL=mouse.js.map