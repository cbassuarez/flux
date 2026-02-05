import React from "react";
import { Box, Text } from "ink";
import { PaletteItem } from "../palette/index.js";
import { Card } from "./Card.js";
import { color } from "../theme/index.js";
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
  return (
    <Box width={width}>
      <Card title="Command Palette" meta="/" accent ruleWidth={width - 6} debug={debug}>
        <Box flexDirection="row" gap={1}>
          <Text color={color.muted}>Search</Text>
          <InputLine value={query} placeholder="Type to filter" />
        </Box>
        <Box flexDirection="column" gap={1}>
          {groups.length === 0 ? (
            <Text color={color.muted}>No matches</Text>
          ) : (
            groups.map((group) => (
              <Box key={group.group} flexDirection="column">
                <Text color={color.muted}>{group.group}</Text>
                {group.items.map((item) => {
                  const selected = item.id === selectedId;
                  return (
                    <Text key={item.id} inverse={selected} color={selected ? color.fg : color.fg}>
                      {`  ${item.label}`}
                      {item.hint ? ` ${item.hint}` : ""}
                    </Text>
                  );
                })}
              </Box>
            ))
          )}
        </Box>
        <Text color={color.muted}>Enter to run · Esc to close</Text>
      </Card>
    </Box>
  );
}
