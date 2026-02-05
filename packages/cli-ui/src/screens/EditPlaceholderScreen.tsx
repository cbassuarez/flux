import React from "react";
import { Box, Text } from "ink";
import { Card } from "../components/Card.js";
import { color } from "../theme/index.js";

export function EditPlaceholderScreen({
  width,
  docPath,
  debug,
}: {
  width: number;
  docPath: string | null;
  debug?: boolean;
}) {
  return (
    <Card title="Edit" meta="" accent ruleWidth={width - 6} debug={debug}>
      <Box flexDirection="column" gap={1}>
        <Text color={color.fg}>Editor coming next.</Text>
        {docPath ? (
          <Text color={color.muted}>Current document: {docPath}</Text>
        ) : (
          <Text color={color.muted}>Select a document to get started.</Text>
        )}
        <Text color={color.muted}>Add section (disabled)</Text>
        <Text color={color.muted}>Add figure (disabled)</Text>
      </Box>
    </Card>
  );
}
