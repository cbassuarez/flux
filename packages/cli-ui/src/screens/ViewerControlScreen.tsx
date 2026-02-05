import React from "react";
import { Box, Text } from "ink";
import path from "node:path";
import { Card } from "../components/Card.js";
import { StatusChips } from "../components/StatusChips.js";
import { color, truncateMiddle } from "../theme/index.js";

export function ViewerControlScreen({
  width,
  activeDoc,
  viewerUrl,
  viewerStatus,
  streamOk,
  backend,
  debug,
}: {
  width: number;
  activeDoc: string | null;
  viewerUrl?: string;
  viewerStatus?: {
    docstep: number;
    time: number;
    running: boolean;
    docstepMs: number;
    seed: number;
  } | null;
  streamOk: boolean;
  backend: string;
  debug?: boolean;
}) {
  const docName = activeDoc ? path.basename(activeDoc) : "Viewer";
  const docPath = activeDoc ? truncateMiddle(activeDoc, Math.max(20, width - 12)) : "";

  return (
    <Box flexDirection="column" gap={1}>
      <Card
        title={docName}
        meta={<Text color={streamOk ? "green" : color.muted}>{streamOk ? "● connected" : "○ idle"}</Text>}
        accent
        ruleWidth={width - 6}
        debug={debug}
      >
        {docPath ? <Text color={color.muted}>{docPath}</Text> : null}
        {viewerUrl ? <Text color={color.muted}>{truncateMiddle(viewerUrl, Math.max(20, width - 12))}</Text> : null}
        <StatusChips
          backend={backend}
          live={viewerStatus?.running ?? false}
          seed={viewerStatus?.seed}
          docstep={viewerStatus?.docstep}
          time={viewerStatus?.time}
        />
      </Card>

      <Card title="Controls" meta="" ruleWidth={width - 6} debug={debug}>
        <Text color={color.muted}>p pause/resume · i interval · s seed · j docstep · e export</Text>
        <Text color={color.muted}>Interval: {viewerStatus?.docstepMs ?? 1000}ms</Text>
      </Card>
    </Box>
  );
}
