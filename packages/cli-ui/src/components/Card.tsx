import React from "react";
import { Box, Text } from "ink";
import { accentRule, color, mutedRuleText } from "../theme/index.js";

export function Card({
  title,
  meta,
  accent,
  children,
  footer,
  width,
  ruleWidth,
  debug,
}: {
  title: string;
  meta?: React.ReactNode;
  accent?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number | string;
  ruleWidth?: number;
  debug?: boolean;
}) {
  const computedRule = accent
    ? accentRule(ruleWidth ?? 24)
    : mutedRuleText(ruleWidth ?? 24);

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      paddingY={0}
      width={width}
      borderStyle={debug ? "classic" : undefined}
      borderColor={debug ? "magenta" : undefined}
    >
      <Box flexDirection="row" justifyContent="space-between" paddingTop={1}>
        <Text color={color.fg} bold>{title}</Text>
        {meta
          ? typeof meta === "string"
            ? <Text color={color.muted}>{meta}</Text>
            : meta
          : null}
      </Box>
      <Text>{computedRule}</Text>
      <Box flexDirection="column" paddingY={1} gap={1}>
        {children}
      </Box>
      {footer ? (
        <Box paddingBottom={1}>
          {footer}
        </Box>
      ) : null}
    </Box>
  );
}
