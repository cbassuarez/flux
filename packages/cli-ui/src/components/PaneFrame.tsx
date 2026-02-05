import React from "react";
import { Box } from "ink";
import { color } from "../theme/index.js";

export function PaneFrame({
  focused,
  width,
  height,
  flexGrow,
  children,
}: {
  focused: boolean;
  width?: number;
  height?: number | string;
  flexGrow?: number;
  children: React.ReactNode;
}) {
  return (
    <Box
      borderStyle="round"
      borderColor={focused ? color.fg : color.border}
      paddingX={1}
      paddingY={0}
      width={width}
      height={height}
      flexGrow={flexGrow}
      flexDirection="column"
    >
      {children}
    </Box>
  );
}
