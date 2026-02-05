import React from "react";
import { Box } from "ink";
import { color } from "../theme/index.js";

export function AppFrame({ children, debug }: { children: React.ReactNode; debug?: boolean }) {
  return (
    <Box
      borderStyle="single"
      borderColor={debug ? "yellow" : color.border}
      padding={1}
      flexDirection="column"
      height="100%"
      width="100%"
      position="relative"
    >
      {children}
    </Box>
  );
}
