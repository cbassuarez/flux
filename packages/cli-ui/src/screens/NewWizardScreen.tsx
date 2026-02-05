import React from "react";
import { Box, Text } from "ink";
import path from "node:path";
import { Card } from "../components/Card.js";
import { WizardStep, WizardValues } from "../state/types.js";
import { color } from "../theme/index.js";
import { InputLine } from "../components/InputLine.js";

export function NewWizardScreen({
  width,
  step,
  stepIndex,
  stepsCount,
  values,
  selectedIndex,
  created,
  postCreate,
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
  postCreate: { openViewer: boolean; setCurrent: boolean; selectedIndex: number };
  outputDir: string;
  debug?: boolean;
}) {
  if (created) {
    return (
      <Card title="Document created" meta="" accent ruleWidth={width - 6} debug={debug}>
        <Text color={color.muted}>{created.docPath}</Text>
        <Box flexDirection="column" gap={0}>
          <Text color={postCreate.selectedIndex === 0 ? color.fg : color.muted}>
            {postCreate.selectedIndex === 0 ? ">" : " "} Open viewer now: {postCreate.openViewer ? "yes" : "no"}
          </Text>
          <Text color={postCreate.selectedIndex === 1 ? color.fg : color.muted}>
            {postCreate.selectedIndex === 1 ? ">" : " "} Set as current document: {postCreate.setCurrent ? "yes" : "no"}
          </Text>
        </Box>
        <Text color={color.muted}>↑/↓ select · Space to toggle · Enter to continue · Esc to close</Text>
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
    const outputPath = outputDir ? path.join(outputDir, values.name, `${values.name}.flux`) : `${values.name}.flux`;
    return (
      <Card title="Summary" meta="" accent ruleWidth={width - 6} debug={debug}>
        <Text color={color.muted}>Title: {values.title}</Text>
        <Text color={color.muted}>Name: {values.name}</Text>
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

  if (step.kind === "input") {
    const value = values[step.key];
    return (
      <Card
        title="New document"
        meta={`${step.label} ${stepIndex + 1}/${stepsCount}`}
        accent
        ruleWidth={width - 6}
        debug={debug}
      >
        <Box flexDirection="column" gap={1}>
          <Text color={color.muted}>{step.label}</Text>
          <InputLine value={String(value ?? "")} placeholder={step.placeholder ?? "Type to edit"} />
        </Box>
        <Text color={color.muted}>Type to edit · Enter to continue · Backspace to go back · Esc to cancel</Text>
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
