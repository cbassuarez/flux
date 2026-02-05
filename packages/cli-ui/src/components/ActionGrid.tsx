import React from "react";
import { Box } from "ink";
import { Button } from "./Button.js";

export type ActionItem = {
  id: string;
  label: string;
  icon?: string;
  onClick: () => void;
  active?: boolean;
};

export function ActionGrid({ items }: { items: ActionItem[] }) {
  const left = items.filter((_, idx) => idx % 2 === 0);
  const right = items.filter((_, idx) => idx % 2 === 1);

  return (
    <Box flexDirection="row" gap={2}>
      <Box flexDirection="column" gap={1}>
        {left.map((item) => (
          <Button key={item.id} {...item} />
        ))}
      </Box>
      <Box flexDirection="column" gap={1}>
        {right.map((item) => (
          <Button key={item.id} {...item} />
        ))}
      </Box>
    </Box>
  );
}
