import React from "react";
import { Box, Text } from "ink";
import { ProgressState } from "../state/progress.js";
import { color } from "../theme/index.js";

function renderBar(percent: number, width: number) {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  return `${"=".repeat(filled)}${"-".repeat(Math.max(0, width - filled))}`;
}

export function TaskProgressView({ progress }: { progress: ProgressState | null }) {
  if (!progress) return null;
  return (
    <Box flexDirection="column" gap={0}>
      <Text color={color.muted}>{`${progress.label} · ${progress.phase}`}</Text>
      <Text color={color.muted}>{renderBar(progress.percent, 24)} {progress.percent}%</Text>
    </Box>
  );
}
