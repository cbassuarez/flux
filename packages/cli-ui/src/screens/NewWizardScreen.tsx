import React from "react";
import { Box, Text } from "ink";
import path from "node:path";
import { Card } from "../components/Card.js";
import { WizardStep, WizardValues } from "../state/types.js";
import { color } from "../theme/index.js";

export function NewWizardScreen({
  width,
  step,
  stepIndex,
  stepsCount,
  values,
  selectedIndex,
  created,
  openChoice,
  outputDir,
  debug,
}: {
  width: number;
  step: WizardStep | null;
  stepIndex: number;
  stepsCount: number;
  values: WizardValues;
  selectedIndex: number;
  created: { docPath: string } | null;
  openChoice: number;
  outputDir: string;
  debug?: boolean;
}) {
  if (created) {
    return (
      <Card title="Document created" meta="" accent ruleWidth={width - 6} debug={debug}>
        <Text color={color.muted}>{created.docPath}</Text>
        <Text color={color.fg}>Open viewer now?</Text>
        <Text color={openChoice === 0 ? color.fg : color.muted}>
          {openChoice === 0 ? ">" : " "} Yes
        </Text>
        <Text color={openChoice === 1 ? color.fg : color.muted}>
          {openChoice === 1 ? ">" : " "} No
        </Text>
        <Text color={color.muted}>Enter to confirm · Esc to close</Text>
      </Card>
    );
  }

  if (!step) {
    return (
      <Card title="New document" meta="" accent ruleWidth={width - 6} debug={debug}>
        <Text color={color.muted}>Loading wizard…</Text>
      </Card>
    );
  }

  if (step.kind === "summary") {
    const title = values.template;
    const outputPath = outputDir ? path.join(outputDir, `${title}.flux`) : `${title}.flux`;
    return (
      <Card title="Summary" meta="" accent ruleWidth={width - 6} debug={debug}>
        <Text color={color.muted}>Template: {values.template}</Text>
        <Text color={color.muted}>Page: {values.page}</Text>
        <Text color={color.muted}>Theme: {values.theme}</Text>
        <Text color={color.muted}>Fonts: {values.fonts}</Text>
        <Text color={color.muted}>Fallback: {values.fontFallback}</Text>
        <Text color={color.muted}>Assets: {values.assets ? "yes" : "no"}</Text>
        <Text color={color.muted}>Chapters: {values.chaptersEnabled ? values.chapters : "no"}</Text>
        <Text color={color.muted}>Live: {values.live ? "yes" : "no"}</Text>
        <Text color={color.muted}>Output: {outputPath}</Text>
        <Text color={color.muted}>Enter to create · Backspace to edit · Esc to cancel</Text>
      </Card>
    );
  }

  return (
    <Card
      title="New document"
      meta={`${step.label} ${stepIndex + 1}/${stepsCount}`}
      accent
      ruleWidth={width - 6}
      debug={debug}
    >
      <Box flexDirection="column" gap={1}>
        {step.options.map((opt, idx) => {
          const selected = idx === selectedIndex;
          return (
            <Text key={`${step.label}-${opt.label}`} color={selected ? color.fg : color.muted}>
              {selected ? ">" : " "} {opt.label} {opt.hint ? `· ${opt.hint}` : ""}
            </Text>
          );
        })}
      </Box>
      <Text color={color.muted}>Enter to continue · Backspace to go back · Esc to cancel</Text>
    </Card>
  );
}
