import React from "react";
import { Box, Text } from "ink";
import { Card } from "../components/Card.js";
import { Clickable } from "../components/Clickable.js";
import { color } from "../theme/index.js";

export function SettingsScreen({
  width,
  config,
  debugLayout,
  onToggleDebug,
  debug,
}: {
  width: number;
  config: any;
  debugLayout: boolean;
  onToggleDebug: () => void;
  debug?: boolean;
}) {
  if (!config) {
    return (
      <Card title="Settings" meta="" accent ruleWidth={width - 6} debug={debug}>
        <Text color={color.muted}>Loading config…</Text>
      </Card>
    );
  }

  return (
    <Card title="Settings" meta="" accent ruleWidth={width - 6} debug={debug}>
      <Box flexDirection="column" gap={1}>
        <Text color={color.muted}>docstepMs: {config.docstepMs}</Text>
        <Text color={color.muted}>advanceTime: {config.advanceTime ? "yes" : "no"}</Text>
        <Text color={color.muted}>defaultPage: {config.defaultPageSize}</Text>
        <Text color={color.muted}>defaultTheme: {config.defaultTheme}</Text>
        <Text color={color.muted}>defaultFonts: {config.defaultFonts}</Text>
        <Clickable id="toggle-debug" onClick={onToggleDebug} priority={1}>
          <Text color={debugLayout ? color.fg : color.muted}>
            Debug layout: {debugLayout ? "on" : "off"}
          </Text>
        </Clickable>
        <Text color={color.muted}>Press I to initialize config · D to set docstepMs · T to toggle debug</Text>
      </Box>
    </Card>
  );
}
