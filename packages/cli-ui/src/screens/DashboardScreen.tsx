import React from "react";
import { Box, Text } from "ink";
import path from "node:path";
import { ActionGrid } from "../components/ActionGrid.js";
import { Card } from "../components/Card.js";
import { Collapsible } from "../components/Collapsible.js";
import { StatusChips } from "../components/StatusChips.js";
import { color, truncateMiddle } from "../theme/index.js";
import { Button } from "../components/Button.js";

export function DashboardScreen({
  width,
  activeDoc,
  backend,
  viewerStatus,
  streamOk,
  logs,
  logsOpen,
  onToggleLogs,
  actionItems,
  showEmptyState,
  onEmptyAction,
  debug,
}: {
  width: number;
  activeDoc: string | null;
  backend: string;
  viewerStatus?: { docstep: number; time: number; seed: number } | null;
  streamOk: boolean;
  logs: string[];
  logsOpen: boolean;
  onToggleLogs: () => void;
  actionItems: { id: string; label: string; icon?: string; onClick: () => void; active?: boolean }[];
  showEmptyState: boolean;
  onEmptyAction: (action: "new" | "open") => void;
  debug?: boolean;
}) {
  const docName = activeDoc ? path.basename(activeDoc) : "No document selected";
  const docPath = activeDoc ? truncateMiddle(activeDoc, Math.max(20, width - 12)) : "Select a document to get started.";

  return (
    <Box flexDirection="column" gap={1}>
      <Card
        title={docName}
        meta={<Text color={streamOk ? "green" : color.muted}>{streamOk ? "● connected" : "○ idle"}</Text>}
        accent
        ruleWidth={width - 6}
        debug={debug}
      >
        <Text color={color.muted}>{docPath}</Text>
        <StatusChips
          backend={backend}
          live={streamOk}
          seed={viewerStatus?.seed}
          docstep={viewerStatus?.docstep}
          time={viewerStatus?.time}
        />
      </Card>

      <Card title="Actions" meta="" ruleWidth={width - 6} debug={debug}>
        <ActionGrid items={actionItems} />
      </Card>

      {showEmptyState ? (
        <Card title="Welcome" meta="" ruleWidth={width - 6} debug={debug}>
          <Text color={color.fg}>Start a new Flux doc or open an existing one.</Text>
          <Box flexDirection="row" gap={2}>
            <Button id="empty-new" label="New" onClick={() => onEmptyAction("new")} />
            <Button id="empty-open" label="Open" onClick={() => onEmptyAction("open")} />
          </Box>
          <Text color={color.muted}>Tip: Press / for the command palette.</Text>
        </Card>
      ) : null}

      {logs.length > 0 ? (
        <Card title="Diagnostics" meta={logsOpen ? "expanded" : "collapsed"} ruleWidth={width - 6} debug={debug}>
          <Collapsible
            id="diagnostics"
            title={`Errors (${logs.length})`}
            summary={logsOpen ? "Enter to collapse" : "Press Enter to expand"}
            isOpen={logsOpen}
            onToggle={onToggleLogs}
          >
            {logs.slice(0, 6).map((line, idx) => (
              <Text key={`${line}-${idx}`} color={color.muted}>{line}</Text>
            ))}
            <Text color={color.muted}>Suggestion: run `flux check` for full output.</Text>
          </Collapsible>
        </Card>
      ) : null}
    </Box>
  );
}
