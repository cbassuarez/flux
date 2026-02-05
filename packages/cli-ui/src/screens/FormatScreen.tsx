import React from "react";
import { Box, Text } from "ink";
import path from "node:path";
import { Card } from "../components/Card.js";
import { Button } from "../components/Button.js";
import { Collapsible } from "../components/Collapsible.js";
import { color, truncateMiddle } from "../theme/index.js";

export function FormatScreen({
  width,
  docPath,
  summary,
  logs,
  logsOpen,
  onToggleLogs,
  onRun,
  debug,
}: {
  width: number;
  docPath: string | null;
  summary: string;
  logs: string[];
  logsOpen: boolean;
  onToggleLogs: () => void;
  onRun: () => void;
  debug?: boolean;
}) {
  return (
    <Box flexDirection="column" gap={1}>
      <Card title="Format" meta="" accent ruleWidth={width - 6} debug={debug}>
        {docPath ? (
          <Box flexDirection="column" gap={0}>
            <Text color={color.muted}>Document: {path.basename(docPath)}</Text>
            <Text color={color.muted}>Path: {truncateMiddle(docPath, Math.max(16, width - 10))}</Text>
          </Box>
        ) : (
          <Text color={color.muted}>No document selected.</Text>
        )}
        <Text color={color.fg}>{summary}</Text>
        <Box marginTop={1}>
          <Button id="format-run" label="Run Format" icon="≡" onClick={onRun} />
        </Box>
      </Card>

      {logs.length > 0 ? (
        <Card title="Diagnostics" meta={logsOpen ? "expanded" : "collapsed"} ruleWidth={width - 6} debug={debug}>
          <Collapsible
            id="format-logs"
            title={`Details (${logs.length})`}
            summary={logsOpen ? "Enter to collapse" : "Press Enter or L to expand"}
            isOpen={logsOpen}
            onToggle={onToggleLogs}
          >
            {logs.map((line, idx) => (
              <Text key={`${line}-${idx}`} color={color.muted}>{line}</Text>
            ))}
          </Collapsible>
        </Card>
      ) : null}
    </Box>
  );
}
