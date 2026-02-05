import React, { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { DOMElement, measureElement, useInput } from "ink";

type RegionBounds = { x: number; y: number; width: number; height: number };

type Region = {
  id: string;
  bounds: RegionBounds;
  onClick: () => void;
  priority: number;
};

type MouseContextValue = {
  register: (region: Region) => void;
  unregister: (id: string) => void;
};

const MouseContext = createContext<MouseContextValue | null>(null);

export function MouseProvider({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  const regionsRef = useRef<Map<string, Region>>(new Map());

  const register = useCallback((region: Region) => {
    regionsRef.current.set(region.id, region);
  }, []);

  const unregister = useCallback((id: string) => {
    regionsRef.current.delete(id);
  }, []);

  useEffect(() => {
    if (disabled) return;
    const stdout = process.stdout;
    if (!stdout?.isTTY) return;
    stdout.write("\u001b[?1000h\u001b[?1006h");
    return () => {
      stdout.write("\u001b[?1000l\u001b[?1006l");
    };
  }, [disabled]);

  useInput((input) => {
    if (disabled) return;
    if (!input || !input.includes("\u001b[<")) return;
    const events = parseMouseSequences(input);
    for (const event of events) {
      if (!event.pressed || event.button !== 0) continue;
      const x = event.x - 1;
      const y = event.y - 1;
      const matches = Array.from(regionsRef.current.values()).filter((region) => {
        const withinX = x >= region.bounds.x && x < region.bounds.x + region.bounds.width;
        const withinY = y >= region.bounds.y && y < region.bounds.y + region.bounds.height;
        return withinX && withinY;
      });
      if (matches.length === 0) continue;
      matches.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        const areaA = a.bounds.width * a.bounds.height;
        const areaB = b.bounds.width * b.bounds.height;
        return areaA - areaB;
      });
      matches[0]?.onClick();
    }
  }, { isActive: !disabled });

  return (
    <MouseContext.Provider value={{ register, unregister }}>
      {children}
    </MouseContext.Provider>
  );
}

export function useMouseRegion(id: string, onClick: () => void, priority = 0) {
  const ctx = useContext(MouseContext);
  const ref = useRef<DOMElement>(null);

  useEffect(() => {
    if (!ctx || !ref.current) return;
    try {
      const bounds = measureElement(ref.current) as RegionBounds;
      ctx.register({ id, bounds, onClick, priority });
      return () => ctx.unregister(id);
    } catch {
      return;
    }
  });

  return ref;
}

type MouseEvent = { button: number; x: number; y: number; pressed: boolean };

function parseMouseSequences(input: string): MouseEvent[] {
  const events: MouseEvent[] = [];
  const regex = /\u001b\[<(\d+);(\d+);(\d+)([mM])/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    const buttonCode = Number(match[1]);
    const x = Number(match[2]);
    const y = Number(match[3]);
    const pressed = match[4] === "M";
    const isScroll = buttonCode >= 64;
    const isMove = (buttonCode & 32) === 32;
    if (isScroll || isMove) continue;
    const button = buttonCode & 3;
    events.push({ button, x, y, pressed });
  }
  return events;
}
