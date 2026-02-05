import React from "react";
import { Box, Text } from "ink";
import { color } from "../theme/index.js";

function Chip({ label, tone }: { label: string; tone?: string }) {
  return (
    <Box marginRight={1}>
      <Text backgroundColor={color.panelAlt} color={tone ?? color.muted}>{` ${label} `}</Text>
    </Box>
  );
}

export function StatusChips({
  backend,
  live,
  seed,
  docstep,
  time,
}: {
  backend?: string;
  live?: boolean;
  seed?: number;
  docstep?: number;
  time?: number;
}) {
  return (
    <Box flexDirection="row" flexWrap="wrap">
      {backend ? <Chip label={`backend ${backend}`} /> : null}
      {typeof live === "boolean" ? <Chip label={live ? "live" : "idle"} tone={live ? "green" : color.muted} /> : null}
      {typeof seed === "number" ? <Chip label={`seed ${seed}`} /> : null}
      {typeof docstep === "number" ? <Chip label={`docstep ${docstep}`} /> : null}
      {typeof time === "number" ? <Chip label={`time ${time.toFixed?.(2) ?? time}`} /> : null}
    </Box>
  );
}
