import React from "react";
import { Box, Text } from "ink";
import path from "node:path";
import { Card } from "../components/Card.js";
import { Button } from "../components/Button.js";
import { TaskProgressView } from "../components/TaskProgressView.js";
import { ProgressState } from "../state/progress.js";
import { color, truncateMiddle } from "../theme/index.js";

export function ExportScreen({
  width,
  docPath,
  outputPath,
  progress,
  resultPath,
  actionIndex,
  onExport,
  onOpenFile,
  onReveal,
  onCopyPath,
  debug,
}: {
  width: number;
  docPath: string | null;
  outputPath: string | null;
  progress: ProgressState | null;
  resultPath: string | null;
  actionIndex: number;
  onExport: () => void;
  onOpenFile: () => void;
  onReveal: () => void;
  onCopyPath: () => void;
  debug?: boolean;
}) {
  return (
    <Box flexDirection="column" gap={1}>
      <Card title="Export PDF" meta="" accent ruleWidth={width - 6} debug={debug}>
        {docPath ? (
          <Box flexDirection="column" gap={0}>
            <Text color={color.muted}>Document: {path.basename(docPath)}</Text>
            <Text color={color.muted}>Path: {truncateMiddle(docPath, Math.max(16, width - 10))}</Text>
          </Box>
        ) : (
          <Text color={color.muted}>No document selected.</Text>
        )}
        {outputPath ? (
          <Text color={color.muted}>Output: {truncateMiddle(outputPath, Math.max(16, width - 10))}</Text>
        ) : null}
        <Box marginTop={1}>
          <Button id="export-run" label="Export PDF" icon="⇩" onClick={onExport} active={actionIndex === 0} />
        </Box>
      </Card>

      {progress ? (
        <Card title="Task" meta="" ruleWidth={width - 6} debug={debug}>
          <TaskProgressView progress={progress} />
        </Card>
      ) : null}

      {resultPath ? (
        <Card title="Export complete" meta="" ruleWidth={width - 6} debug={debug}>
          <Text color={color.muted}>{truncateMiddle(resultPath, Math.max(16, width - 8))}</Text>
          <Box flexDirection="row" gap={2}>
            <Button id="export-open" label="Open file" onClick={onOpenFile} active={actionIndex === 1} />
            <Button id="export-reveal" label="Reveal in folder" onClick={onReveal} active={actionIndex === 2} />
            <Button id="export-copy" label="Copy path" onClick={onCopyPath} active={actionIndex === 3} />
          </Box>
        </Card>
      ) : null}
    </Box>
  );
}
