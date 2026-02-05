import React from "react";
import { Box, Text } from "ink";
import path from "node:path";
import { NavItem } from "../state/types.js";
import { accent, color, truncateMiddle } from "../theme/index.js";
import { Clickable } from "./Clickable.js";

const ACTION_ICONS: Record<string, string> = {
  new: "+",
  open: "⌁",
  view: "◻︎",
  export: "⇩",
  check: "✓",
  format: "≡",
  add: "+",
  settings: "⚙︎",
};

function formatRelativeTime(value?: string) {
  if (!value) return "";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "";
  const diffMs = Date.now() - parsed;
  const diffSec = Math.max(0, Math.round(diffMs / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

type RenderItem = {
  item: NavItem;
  index: number;
  height: number;
};

export function NavList({
  items,
  selectedIndex,
  onSelect,
  width,
  maxHeight,
  debug,
}: {
  items: NavItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  width: number;
  maxHeight?: number;
  debug?: boolean;
}) {
  const renderItems: RenderItem[] = items.map((item, index) => ({
    item,
    index,
    height: item.type === "doc" ? 2 : 1,
  }));

  const totalLines = renderItems.reduce((sum, entry) => sum + entry.height, 0);
  const effectiveHeight = maxHeight ?? totalLines;

  let visibleItems = renderItems;
  let showTopHint = false;
  let showBottomHint = false;

  if (totalLines > effectiveHeight) {
    const positions: number[] = [];
    let cursor = 0;
    for (const entry of renderItems) {
      positions.push(cursor);
      cursor += entry.height;
    }
    const selectedLine = positions[selectedIndex] ?? 0;
    const startLine = Math.max(0, Math.min(selectedLine - Math.floor(effectiveHeight / 3), totalLines - effectiveHeight));
    const endLine = startLine + effectiveHeight;

    visibleItems = [];
    for (let i = 0; i < renderItems.length; i += 1) {
      const entry = renderItems[i];
      const lineStart = positions[i];
      const lineEnd = lineStart + entry.height;
      if (lineEnd <= startLine) continue;
      if (lineStart >= endLine) continue;
      visibleItems.push(entry);
    }

    showTopHint = startLine > 0;
    showBottomHint = endLine < totalLines;
  }

  return (
    <Box flexDirection="column" gap={1} borderStyle={debug ? "classic" : undefined} borderColor={debug ? "cyan" : undefined}>
      {showTopHint ? (
        <Text color={color.muted}>...</Text>
      ) : null}
      {visibleItems.map(({ item, index }) => {
        if (item.type === "section") {
          return (
            <Text key={`section-${item.label}-${index}`} color={color.muted}>
              {item.label}
            </Text>
          );
        }
        const selected = index === selectedIndex;
        const icon = item.type === "action" ? ACTION_ICONS[item.id] ?? "•" : "↺";
        const label = item.label;
        const meta = item.type === "doc"
          ? (() => {
              const folder = truncateMiddle(path.dirname(item.path), Math.max(10, Math.floor(width * 0.6)));
              const rel = formatRelativeTime(item.lastOpened);
              return rel ? `${folder} · ${rel}` : folder;
            })()
          : "";

        return (
          <Clickable key={`${item.type}-${item.label}-${index}`} id={`nav-${index}`} onClick={() => onSelect(index)}>
            <Box flexDirection="column">
              <Box flexDirection="row" alignItems="center">
                <Text color={selected ? undefined : color.border}>
                  {selected ? accent("▌") : " "}
                </Text>
                <Text inverse={selected} color={selected ? color.fg : color.fg}>
                  {` ${icon} ${label}`}
                </Text>
              </Box>
              {item.type === "doc" ? (
                <Box flexDirection="row">
                  <Text color={selected ? undefined : color.border}>
                    {selected ? accent("▌") : " "}
                  </Text>
                  <Text inverse={selected} color={selected ? color.muted : color.muted}>
                    {`   ${meta}`}
                  </Text>
                </Box>
              ) : null}
            </Box>
          </Clickable>
        );
      })}
      {showBottomHint ? (
        <Text color={color.muted}>...</Text>
      ) : null}
    </Box>
  );
}
