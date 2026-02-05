import React from "react";
import { Box, Text } from "ink";
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
  const sections = [
    {
      title: "Navigation",
      lines: [
        "Tab switch focus · ↑/↓ move · Enter select",
        "Ctrl+K command palette · ? help · q quit",
      ],
    },
    {
      title: "Open picker",
      lines: [
        "/ focus search · Esc exit search · Backspace go up a folder",
      ],
    },
    {
      title: "Flows",
      lines: [
        "Open → Doc Details → Edit / Export / Doctor / Format",
      ],
    },
    {
      title: "Diagnostics",
      lines: [
        "L toggle logs",
      ],
    },
    {
      title: "Automation",
      lines: [
        "--no-ui for scripts / JSON",
      ],
    },
  ];

  return (
    <Box width={width}>
      <Box flexDirection="column" gap={1}>
        {sections.map((section) => (
          <Box key={section.title} flexDirection="column" gap={0}>
            <Text color={color.fg} bold>{section.title}</Text>
            {section.lines.map((line, idx) => (
              <Text key={`${section.title}-${idx}`} color={color.muted}>
                {line}
              </Text>
            ))}
          </Box>
        ))}
        {extraLines && extraLines.length > 0 ? (
          <Box flexDirection="column" gap={0}>
            <Text color={color.fg} bold>Command help</Text>
            {extraLines.map((line, idx) => (
              <Text key={`help-extra-${idx}`} color={line.trim().length === 0 ? color.muted : color.fg}>
                {line}
              </Text>
            ))}
          </Box>
        ) : null}
        {(backend || recentsPath || version) ? (
          <Box flexDirection="column" gap={0}>
            <Text color={color.fg} bold>Details</Text>
            {version ? <Text color={color.muted}>{`Flux ${version}`}</Text> : null}
            {backend ? <Text color={color.muted}>{`Backend: ${backend}`}</Text> : null}
            {recentsPath ? <Text color={color.muted}>{`Recents: ${recentsPath}`}</Text> : null}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
