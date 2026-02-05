import React from "react";
import { Box, Text } from "ink";
import { color } from "../theme/index.js";

export function InputLine({
  value,
  placeholder,
  focused = false,
}: {
  value: string;
  placeholder?: string;
  focused?: boolean;
}) {
  const showPlaceholder = !value && placeholder;
  const displayValue = showPlaceholder ? placeholder ?? "" : value;
  const displayColor = showPlaceholder ? color.muted : undefined;

  return (
    <Box flexDirection="row">
      {displayValue.length > 0 ? <Text color={displayColor}>{displayValue}</Text> : null}
      {focused ? <Text color={color.muted}>▌</Text> : null}
    </Box>
  );
}
