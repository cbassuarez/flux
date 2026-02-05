import React from "react";
import { Box, Text } from "ink";
import path from "node:path";
import { Card } from "../components/Card.js";
import { ActionGrid } from "../components/ActionGrid.js";
import { Button } from "../components/Button.js";
import { Collapsible } from "../components/Collapsible.js";
import { color, truncateMiddle } from "../theme/index.js";

export function EditScreen({
  width,
  docPath,
  title,
  viewerUrl,
  onCopyUrl,
  onExport,
  onDoctor,
  onFormat,
  logs,
  logsOpen,
  onToggleLogs,
  debug,
}: {
  width: number;
  docPath: string | null;
  title?: string | null;
  viewerUrl?: string | null;
  onCopyUrl: () => void;
  onExport: () => void;
  onDoctor: () => void;
  onFormat: () => void;
  logs: string[];
  logsOpen: boolean;
  onToggleLogs: () => void;
  debug?: boolean;
}) {
  const displayTitle = title ?? (docPath ? path.basename(docPath) : "No document selected");
  const editorUrl = viewerUrl ? `${viewerUrl}/edit` : null;
  return (
    <Box flexDirection="column" gap={1}>
      <Card title="Edit" meta="" accent ruleWidth={width - 6} debug={debug}>
        {docPath ? (
          <Box flexDirection="column" gap={0}>
            <Text color={color.muted}>Document: {displayTitle}</Text>
            <Text color={color.muted}>Path: {truncateMiddle(docPath, Math.max(16, width - 10))}</Text>
          </Box>
        ) : (
          <Text color={color.muted}>Select a document to get started.</Text>
        )}
        {viewerUrl ? (
          <Box flexDirection="column" gap={0} marginTop={1}>
            <Text color={color.muted}>Viewer URL: {truncateMiddle(viewerUrl, Math.max(16, width - 10))}</Text>
            <Text color={color.muted}>Editor URL: {truncateMiddle(editorUrl ?? "", Math.max(16, width - 10))}</Text>
            <Box marginTop={1}>
              <Button id="edit-copy-url" label="Copy URL" icon="C" onClick={onCopyUrl} />
            </Box>
          </Box>
        ) : (
          <Text color={color.muted}>Start the editor to get a local URL.</Text>
        )}
      </Card>

      <Card title="Shortcuts" meta="" ruleWidth={width - 6} debug={debug}>
        <ActionGrid
          items={[
            { id: "edit-export", label: "Export PDF", icon: "E", onClick: onExport },
            { id: "edit-doctor", label: "Doctor", icon: "D", onClick: onDoctor },
            { id: "edit-format", label: "Format", icon: "F", onClick: onFormat },
          ]}
        />
      </Card>

      <Card title="Logs" meta={logsOpen ? "expanded" : "collapsed"} ruleWidth={width - 6} debug={debug}>
        <Collapsible
          id="edit-logs"
          title="Session"
          summary={logsOpen ? "Enter to collapse" : "Press Enter or L to expand"}
          isOpen={logsOpen}
          onToggle={onToggleLogs}
        >
          {logs.length ? (
            logs.map((line, idx) => (
              <Text key={`${line}-${idx}`} color={color.muted}>{line}</Text>
            ))
          ) : (
            <Text color={color.muted}>No logs yet.</Text>
          )}
        </Collapsible>
      </Card>
    </Box>
  );
}
