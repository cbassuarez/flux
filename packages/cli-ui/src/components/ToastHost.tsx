import React from "react";
import { Box, Text } from "ink";
import { Toast } from "../state/toasts.js";
import { color } from "../theme/index.js";
import { ProgressState } from "../state/progress.js";
import { Spinner } from "./Spinner.js";

function renderBar(percent: number, width: number) {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  return `${"=".repeat(filled)}${"-".repeat(Math.max(0, width - filled))}`;
}

export function ToastHost({
  toasts,
  busy,
  progress,
}: {
  toasts: Toast[];
  busy?: string | null;
  progress?: ProgressState | null;
}) {
  if (!busy && !progress && toasts.length === 0) return null;

  return (
    <Box flexDirection="column" alignItems="flex-end" width="100%" gap={1}>
      {busy ? (
        <Box flexDirection="row" gap={1}>
          <Text color={color.muted}>
            <Spinner />
          </Text>
          <Text color={color.muted}>{busy}</Text>
        </Box>
      ) : null}
      {progress ? (
        <Box flexDirection="column" alignItems="flex-end">
          <Text color={color.muted}>{`${progress.label} · ${progress.phase}`}</Text>
          <Text color={color.muted}>{renderBar(progress.percent, 24)} {progress.percent}%</Text>
        </Box>
      ) : null}
      {toasts.map((toast) => {
        const tone = toast.kind === "error" ? color.danger : toast.kind === "success" ? "green" : color.muted;
        return (
          <Text key={toast.id} color={tone}>{toast.message}</Text>
        );
      })}
    </Box>
  );
}
