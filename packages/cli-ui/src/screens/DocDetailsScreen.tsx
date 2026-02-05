import React from "react";
import { Box, Text } from "ink";
import path from "node:path";
import { Card } from "../components/Card.js";
import { ActionGrid } from "../components/ActionGrid.js";
import { Button } from "../components/Button.js";
import { color, truncateMiddle } from "../theme/index.js";

export type DocDetailsPreview = {
  title?: string | null;
  filePath: string;
  modified?: string;
  size?: string;
};

export function DocDetailsScreen({
  width,
  docPath,
  preview,
  primaryActions,
  secondaryActions,
  debug,
}: {
  width: number;
  docPath: string | null;
  preview: DocDetailsPreview | null;
  primaryActions: { id: string; label: string; icon?: string; onClick: () => void; active?: boolean }[];
  secondaryActions: { id: string; label: string; icon?: string; onClick: () => void; active?: boolean }[];
  debug?: boolean;
}) {
  const title = preview?.title ?? (docPath ? path.basename(docPath) : "No document selected");
  const filePath = docPath ?? "";
  return (
    <Box flexDirection="column" gap={1}>
      <Card title={title} meta="" accent ruleWidth={width - 6} debug={debug}>
        {filePath ? (
          <Box flexDirection="column" gap={0}>
            <Text color={color.muted}>{truncateMiddle(filePath, Math.max(16, width - 8))}</Text>
            {preview?.modified ? <Text color={color.muted}>Modified: {preview.modified}</Text> : null}
            {preview?.size ? <Text color={color.muted}>Size: {preview.size}</Text> : null}
          </Box>
        ) : (
          <Text color={color.muted}>Select a document to get started.</Text>
        )}
      </Card>

      <Card title="Primary actions" meta="" ruleWidth={width - 6} debug={debug}>
        <ActionGrid items={primaryActions} />
      </Card>

      <Card title="Secondary actions" meta="" ruleWidth={width - 6} debug={debug}>
        <Box flexDirection="row" gap={2}>
          {secondaryActions.map((action) => (
            <Button key={action.id} {...action} />
          ))}
        </Box>
      </Card>
    </Box>
  );
}
