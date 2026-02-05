import React from "react";
import { Box, Text } from "ink";
import { PaletteItem } from "../palette/index.js";
import { accent, color } from "../theme/index.js";
import { InputLine } from "./InputLine.js";

export function CommandPaletteModal({
  query,
  groups,
  selectedId,
  width,
  debug,
}: {
  query: string;
  groups: { group: string; items: PaletteItem[] }[];
  selectedId?: string;
  width: number;
  debug?: boolean;
}) {
  const lineWidth = Math.max(0, width);
  const contentWidth = Math.max(0, lineWidth - 2);
  const padLine = (value: string) => {
    if (value.length >= lineWidth) return value.slice(0, lineWidth);
    return `${value}${" ".repeat(lineWidth - value.length)}`;
  };
  const truncate = (value: string, max: number) => {
    if (value.length <= max) return value;
    if (max <= 3) return value.slice(0, max);
    return `${value.slice(0, max - 3)}...`;
  };

  const renderItemLine = (label: string, hint: string | undefined, selected: boolean) => {
    let labelText = label;
    let hintText = hint ? ` ${hint}` : "";
    const available = Math.max(0, contentWidth);
    if (labelText.length + hintText.length > available) {
      const maxLabel = Math.max(0, available - hintText.length);
      labelText = truncate(labelText, maxLabel);
      const total = labelText.length + hintText.length;
      if (total > available) {
        const maxHint = Math.max(0, available - labelText.length);
        hintText = truncate(hintText, maxHint);
      }
    }
    const padding = " ".repeat(Math.max(0, available - (labelText.length + hintText.length)));
    return (
      <Text
        backgroundColor={selected ? color.panel : color.panelAlt}
        color={selected ? color.fg : color.fg}
        bold={selected}
        inverse={selected}
      >
        {selected ? accent("▌") : " "}
        {" "}
        {labelText}
        {hintText ? <Text color={color.muted}>{hintText}</Text> : null}
        {padding}
      </Text>
    );
  };

  return (
    <Box width={width}>
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" gap={1}>
          <Text color={color.muted}>Search</Text>
          <InputLine value={query} placeholder="Type to filter" focused />
        </Box>
        <Box flexDirection="column" gap={1}>
          {groups.length === 0 ? (
            <Text backgroundColor={color.panelAlt} color={color.muted}>{padLine("No matches")}</Text>
          ) : (
            groups.map((group) => (
              <Box key={group.group} flexDirection="column" gap={0}>
                <Text backgroundColor={color.panelAlt} color={color.muted} bold>{padLine(group.group)}</Text>
                {group.items.map((item) => {
                  const selected = item.id === selectedId;
                  return (
                    <Box key={item.id} width={lineWidth}>
                      {renderItemLine(item.label, item.hint, selected)}
                    </Box>
                  );
                })}
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
}
