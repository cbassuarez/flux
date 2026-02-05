import React from "react";
import { Box, Text } from "ink";
import { Card } from "./Card.js";
import { color } from "../theme/index.js";
import { InputLine } from "./InputLine.js";

export function PromptModal({
  label,
  value,
  width,
  debug,
}: {
  label: string;
  value: string;
  width: number;
  debug?: boolean;
}) {
  return (
    <Box width={width}>
      <Card title={label} meta="" accent ruleWidth={width - 6} debug={debug}>
        <Box flexDirection="row" gap={1}>
          <Text color={color.muted}>Value</Text>
          <InputLine value={value} placeholder="Type a value" />
        </Box>
        <Text color={color.muted}>Enter to submit · Esc to cancel</Text>
      </Card>
    </Box>
  );
}
