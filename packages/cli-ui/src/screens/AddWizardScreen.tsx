import React from "react";
import { Box, Text } from "ink";
import { Card } from "../components/Card.js";
import { color } from "../theme/index.js";

export function AddWizardScreen({ width, debug }: { width: number; debug?: boolean }) {
  return (
    <Card title="Add to document" meta="" accent ruleWidth={width - 6} debug={debug}>
      <Box flexDirection="column" gap={1}>
        <Text color={color.muted}>Add a section, figure, or other building block.</Text>
        <Text color={color.muted}>Use / to open the command palette.</Text>
      </Box>
    </Card>
  );
}
