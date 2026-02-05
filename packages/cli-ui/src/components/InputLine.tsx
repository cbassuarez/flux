import React from "react";
import { Box, Text } from "ink";
import { color } from "../theme/index.js";

export function InputLine({ value, placeholder }: { value: string; placeholder?: string }) {
  if (!value && placeholder) {
    return <Text color={color.muted}>{placeholder}</Text>;
  }
  return (
    <Box flexDirection="row">
      <Text>{value}</Text>
      <Text color={color.muted}>▌</Text>
    </Box>
  );
}
