import React from "react";
import { Text } from "ink";
import { accent, color } from "../theme/index.js";
import { Clickable } from "./Clickable.js";

export function Button({
  id,
  label,
  icon,
  onClick,
  active,
}: {
  id: string;
  label: string;
  icon?: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <Clickable id={id} onClick={onClick} priority={1}>
      <Text backgroundColor={active ? color.panelAlt : color.panel} color={active ? undefined : color.fg}>
        {active
          ? accent(` ${icon ? `${icon} ` : ""}${label} `)
          : ` ${icon ? `${icon} ` : ""}${label} `}
      </Text>
    </Clickable>
  );
}
