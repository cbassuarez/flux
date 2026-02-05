import React from "react";
import { Box, Text } from "ink";
import { Card } from "./Card.js";
import { color } from "../theme/index.js";

export function HelpOverlay({
  width,
  version,
  recentsPath,
  backend,
  extraLines,
}: {
  width: number;
  version?: string;
  recentsPath?: string;
  backend?: string;
  extraLines?: string[];
}) {
  const lines = [
    "Navigation",
    "  ↑/↓ move · Enter select · q quit",
    "  / or Ctrl+K command palette",
    "  ? help overlay · Esc close overlays",
    "Flows",
    "  New → View → Export PDF",
    "  Check → Fix → Format",
    "Viewer",
    "  p pause/resume · i interval · s seed · j docstep · e export",
    "Docs",
    "  o reveal in file explorer · y copy path",
    "Diagnostics",
    "  l toggle logs",
    "Automation",
    "  --no-ui for scripts / JSON",
  ];

  return (
    <Box width={width}>
      <Card title="Help" meta={version ? `Flux ${version}` : "Flux"} accent ruleWidth={width - 6}>
        <Box flexDirection="column" gap={1}>
          {lines.map((line, idx) => (
            <Text key={`help-${idx}`} color={line.trim().length === 0 ? color.muted : color.fg}>
              {line}
            </Text>
          ))}
          {extraLines && extraLines.length > 0 ? (
            <Box flexDirection="column" gap={0}>
              {extraLines.map((line, idx) => (
                <Text key={`help-extra-${idx}`} color={line.trim().length === 0 ? color.muted : color.fg}>
                  {line}
                </Text>
              ))}
            </Box>
          ) : null}
          {backend ? <Text color={color.muted}>{`Backend: ${backend}`}</Text> : null}
          {recentsPath ? <Text color={color.muted}>{`Recents: ${recentsPath}`}</Text> : null}
        </Box>
        <Text color={color.muted}>Press Esc to return</Text>
      </Card>
    </Box>
  );
}
