import React from "react";
import { Box, Text } from "ink";
import { color } from "../theme/index.js";
import { Clickable } from "./Clickable.js";

export function Collapsible({
  id,
  title,
  summary,
  isOpen,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  summary?: string;
  isOpen: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Box flexDirection="column" gap={1}>
      <Clickable id={id} onClick={onToggle} priority={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text color={color.fg}>{`${isOpen ? "▾" : "▸"} ${title}`}</Text>
          {summary ? <Text color={color.muted}>{summary}</Text> : null}
        </Box>
      </Clickable>
      {isOpen ? (
        <Box flexDirection="column" gap={1}>
          {children}
        </Box>
      ) : null}
    </Box>
  );
}
