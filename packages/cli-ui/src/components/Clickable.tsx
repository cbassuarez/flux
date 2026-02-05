import React from "react";
import { Box } from "ink";
import { useMouseRegion } from "../state/mouse.js";

export function Clickable({
  id,
  onClick,
  children,
  priority,
}: {
  id: string;
  onClick: () => void;
  children: React.ReactNode;
  priority?: number;
}) {
  const ref = useMouseRegion(id, onClick, priority ?? 0);
  return (
    <Box ref={ref} flexDirection="column">
      {children}
    </Box>
  );
}
