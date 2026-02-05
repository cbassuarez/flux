import { useEffect, useState } from "react";
import { useStdout } from "ink";
import { DEFAULT_COLS, DEFAULT_ROWS, normalizeDimension } from "./layout.js";

export function useTerminalDimensions() {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState(() => {
    const columns = normalizeDimension(stdout?.columns ?? process.stdout?.columns, DEFAULT_COLS);
    const rows = normalizeDimension(stdout?.rows ?? process.stdout?.rows, DEFAULT_ROWS);
    return { columns, rows };
  });

  useEffect(() => {
    if (!stdout?.on) return;
    const update = () => {
      const columns = normalizeDimension(stdout.columns ?? process.stdout?.columns, DEFAULT_COLS);
      const rows = normalizeDimension(stdout.rows ?? process.stdout?.rows, DEFAULT_ROWS);
      setDimensions((prev) => {
        if (prev.columns === columns && prev.rows === rows) return prev;
        return { columns, rows };
      });
    };
    update();
    stdout.on("resize", update);
    return () => stdout.off("resize", update);
  }, [stdout]);

  return dimensions;
}
