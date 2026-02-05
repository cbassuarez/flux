import React from "react";
import { Box, Text } from "ink";
import path from "node:path";
import { Card } from "../components/Card.js";
import { Button } from "../components/Button.js";
import { Clickable } from "../components/Clickable.js";
import { InputLine } from "../components/InputLine.js";
import { color, truncateMiddle } from "../theme/index.js";

type PreviewInfo = {
  title?: string | null;
  filePath: string;
  modified?: string;
  size?: string;
  status?: string | null;
};

type ListItem = {
  id: string;
  label: string;
  meta?: string;
  path: string;
};

function limitList(items: ListItem[], selectedIndex: number, maxItems: number) {
  if (items.length <= maxItems) {
    return { items, showTop: false, showBottom: false, offset: 0 };
  }
  const safeIndex = Math.max(0, Math.min(selectedIndex, items.length - 1));
  const start = Math.max(0, Math.min(safeIndex - Math.floor(maxItems / 2), items.length - maxItems));
  const end = start + maxItems;
  return {
    items: items.slice(start, end),
    showTop: start > 0,
    showBottom: end < items.length,
    offset: start,
  };
}

export function OpenScreen({
  width,
  query,
  showAll,
  rootDir,
  results,
  selectedIndex,
  folders,
  folderIndex,
  activeList,
  pinnedDirs,
  recentDirs,
  isPinned,
  indexing,
  truncated,
  preview,
  onToggleShowAll,
  onOpenSelected,
  onSelectResult,
  onSelectFolder,
  onSelectPinned,
  onSelectRecent,
  onTogglePin,
  debug,
}: {
  width: number;
  query: string;
  showAll: boolean;
  rootDir: string;
  results: ListItem[];
  selectedIndex: number;
  folders: string[];
  folderIndex: number;
  activeList: "results" | "folders";
  pinnedDirs: string[];
  recentDirs: string[];
  isPinned: boolean;
  indexing: boolean;
  truncated: boolean;
  preview: PreviewInfo | null;
  onToggleShowAll: () => void;
  onOpenSelected: () => void;
  onSelectResult: (index: number) => void;
  onSelectFolder: (index: number) => void;
  onSelectPinned: (dir: string) => void;
  onSelectRecent: (dir: string) => void;
  onTogglePin: () => void;
  debug?: boolean;
}) {
  const resultsList = limitList(results, selectedIndex, 8);
  const foldersList = limitList(
    folders.map((entry, idx) => ({ id: `${entry}-${idx}`, label: path.basename(entry), path: entry })),
    folderIndex,
    6,
  );
  const breadcrumb = truncateMiddle(rootDir, Math.max(18, width - 14));

  return (
    <Box flexDirection="column" gap={1}>
      {truncated ? (
        <Card title="Index limit reached" meta="" ruleWidth={width - 6} debug={debug}>
          <Text color={color.muted}>Too many files; narrow search or browse folders.</Text>
        </Card>
      ) : null}

      <Card
        title="Open"
        meta={indexing ? "indexing…" : `${results.length} results`}
        accent
        ruleWidth={width - 6}
        debug={debug}
      >
        <Box flexDirection="row" gap={1} alignItems="center">
          <Text color={color.muted}>Search</Text>
          <InputLine value={query} placeholder="Type to filter" />
          <Clickable id="toggle-filter" onClick={onToggleShowAll} priority={1}>
            <Text color={color.muted}>
              {showAll ? "Filter: all" : "Filter: *.flux"}
            </Text>
          </Clickable>
        </Box>

        <Box flexDirection="column" gap={0}>
          <Text color={color.muted}>{activeList === "results" ? "Results" : "Results (inactive)"}</Text>
          {results.length === 0 ? (
            <Text color={color.muted}>No matches yet.</Text>
          ) : (
            <Box flexDirection="column" gap={0}>
              {resultsList.showTop ? <Text color={color.muted}>…</Text> : null}
              {resultsList.items.map((item, idx) => {
                const absoluteIndex = resultsList.offset + idx;
                const selected = activeList === "results" && absoluteIndex === selectedIndex;
                return (
                  <Clickable key={item.id} id={`open-result-${item.id}`} onClick={() => onSelectResult(absoluteIndex)} priority={1}>
                    <Text inverse={selected} color={selected ? color.fg : color.fg}>
                      {`${selected ? ">" : " "} ${item.label}`}
                      {item.meta ? ` ${item.meta}` : ""}
                    </Text>
                  </Clickable>
                );
              })}
              {resultsList.showBottom ? <Text color={color.muted}>…</Text> : null}
            </Box>
          )}
          <Box marginTop={1}>
            <Button id="open-selected" label="Open selected" icon="↩" onClick={onOpenSelected} />
          </Box>
        </Box>

        <Box flexDirection="column" gap={0}>
          <Text color={color.muted}>Pinned / Recent directories</Text>
          <Clickable id="toggle-pin" onClick={onTogglePin} priority={1}>
            <Text color={color.muted}>{isPinned ? "Unpin current directory" : "Pin current directory"}</Text>
          </Clickable>
          {pinnedDirs.length === 0 && recentDirs.length === 0 ? (
            <Text color={color.muted}>No pinned or recent directories yet.</Text>
          ) : (
            <Box flexDirection="column" gap={0}>
              {pinnedDirs.map((dir) => (
                <Clickable key={`pin-${dir}`} id={`pin-${dir}`} onClick={() => onSelectPinned(dir)} priority={1}>
                  <Text color={color.fg}>{`★ ${truncateMiddle(dir, Math.max(10, width - 10))}`}</Text>
                </Clickable>
              ))}
              {recentDirs.map((dir) => (
                <Clickable key={`recent-${dir}`} id={`recent-${dir}`} onClick={() => onSelectRecent(dir)} priority={1}>
                  <Text color={color.muted}>{`↺ ${truncateMiddle(dir, Math.max(10, width - 10))}`}</Text>
                </Clickable>
              ))}
            </Box>
          )}
        </Box>

        <Box flexDirection="column" gap={0}>
          <Text color={color.muted}>{activeList === "folders" ? "Browse" : "Browse (inactive)"}</Text>
          <Text color={color.muted}>{breadcrumb}</Text>
          {folders.length === 0 ? (
            <Text color={color.muted}>No subfolders.</Text>
          ) : (
            <Box flexDirection="column" gap={0}>
              {foldersList.showTop ? <Text color={color.muted}>…</Text> : null}
              {foldersList.items.map((item, idx) => {
                const absoluteIndex = foldersList.offset + idx;
                const selected = activeList === "folders" && absoluteIndex === folderIndex;
                return (
                  <Clickable key={item.id} id={`open-folder-${item.id}`} onClick={() => onSelectFolder(absoluteIndex)} priority={1}>
                    <Text inverse={selected} color={selected ? color.fg : color.fg}>
                      {`${selected ? ">" : " "} ${item.label}/`}
                    </Text>
                  </Clickable>
                );
              })}
              {foldersList.showBottom ? <Text color={color.muted}>…</Text> : null}
            </Box>
          )}
          <Text color={color.muted}>Backspace to go up</Text>
        </Box>
      </Card>

      <Card title="Preview" meta="" ruleWidth={width - 6} debug={debug}>
        {preview ? (
          <Box flexDirection="column" gap={0}>
            <Text color={color.fg}>{preview.title ?? path.basename(preview.filePath)}</Text>
            <Text color={color.muted}>{truncateMiddle(preview.filePath, Math.max(12, width - 8))}</Text>
            {preview.modified ? <Text color={color.muted}>Modified: {preview.modified}</Text> : null}
            {preview.size ? <Text color={color.muted}>Size: {preview.size}</Text> : null}
            {preview.status ? <Text color={color.muted}>Parse: {preview.status}</Text> : null}
          </Box>
        ) : (
          <Text color={color.muted}>Select a file to see details.</Text>
        )}
      </Card>
    </Box>
  );
}
