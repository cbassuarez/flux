import React, { useMemo } from "react";
import { Box, Text, useInput } from "ink";
import { color, mutedRuleText } from "../theme/index.js";
import { useTerminalDimensions } from "./useTerminalDimensions.js";

export const MODAL_MARGIN = 2;
export const MODAL_MIN_WIDTH = 52;
export const MODAL_MAX_WIDTH = 96;
export const MODAL_MIN_HEIGHT = 12;
export const MODAL_MAX_HEIGHT = 24;
export const MODAL_PADDING_X = 2;
export const MODAL_PADDING_Y = 1;
export const MODAL_BORDER_WIDTH = 1;

type ModalLayoutInput = {
  columns: number;
  rows: number;
  width?: number | "auto";
  height?: number | "auto";
};

export type ModalLayout = {
  width: number;
  height: number;
  left: number;
  top: number;
  contentWidth: number;
  contentHeight: number;
};

export function buildFillLines(width: number, height: number) {
  const safeWidth = Math.max(0, width);
  const safeHeight = Math.max(0, height);
  const line = " ".repeat(safeWidth);
  return Array.from({ length: safeHeight }, () => line).join("\n");
}

export function getModalLayout({ columns, rows, width, height }: ModalLayoutInput): ModalLayout {
  const safeColumns = Math.max(0, columns);
  const safeRows = Math.max(0, rows);
  const maxWidth = Math.max(1, safeColumns - MODAL_MARGIN * 2);
  const maxHeight = Math.max(1, safeRows - MODAL_MARGIN * 2);
  const minWidth = Math.min(MODAL_MIN_WIDTH, maxWidth);
  const minHeight = Math.min(MODAL_MIN_HEIGHT, maxHeight);
  const defaultWidth = Math.min(MODAL_MAX_WIDTH, maxWidth);
  const defaultHeight = Math.min(MODAL_MAX_HEIGHT, maxHeight);
  const rawWidth = typeof width === "number" ? width : defaultWidth;
  const rawHeight = typeof height === "number" ? height : defaultHeight;
  const panelWidth = Math.max(minWidth, Math.min(rawWidth, maxWidth));
  const panelHeight = Math.max(minHeight, Math.min(rawHeight, maxHeight));
  const left = Math.max(0, Math.floor((safeColumns - panelWidth) / 2));
  const top = Math.max(0, Math.floor((safeRows - panelHeight) / 2));
  const contentWidth = Math.max(0, panelWidth - MODAL_PADDING_X * 2 - MODAL_BORDER_WIDTH * 2);
  const contentHeight = Math.max(0, panelHeight - MODAL_PADDING_Y * 2 - MODAL_BORDER_WIDTH * 2);

  return {
    width: panelWidth,
    height: panelHeight,
    left,
    top,
    contentWidth,
    contentHeight,
  };
}

export function ModalOverlay({
  isOpen,
  title,
  subtitle,
  width,
  height,
  onRequestClose,
  children,
  footer,
}: {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  width?: number | "auto";
  height?: number | "auto";
  onRequestClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { columns, rows } = useTerminalDimensions();
  const layout = useMemo(() => getModalLayout({ columns, rows, width, height }), [columns, rows, width, height]);
  const scrimFill = useMemo(() => buildFillLines(columns, rows), [columns, rows]);
  const panelFill = useMemo(() => buildFillLines(layout.width, layout.height), [layout.width, layout.height]);

  useInput((_, key) => {
    if (key.escape) {
      onRequestClose();
    }
  }, { isActive: isOpen });

  if (!isOpen) return null;

  return (
    <Box position="absolute" top={0} left={0} width={columns} height={rows}>
      <Box position="absolute" top={0} left={0} width={columns} height={rows}>
        <Text backgroundColor={color.panel} color={color.panel}>{scrimFill}</Text>
      </Box>
      <Box position="absolute" top={layout.top} left={layout.left} width={layout.width} height={layout.height}>
        <Box position="relative" width={layout.width} height={layout.height}>
          <Box position="absolute" top={0} left={0} width={layout.width} height={layout.height}>
            <Text backgroundColor={color.panelAlt} color={color.panelAlt}>{panelFill}</Text>
          </Box>
          <Box
            flexDirection="column"
            paddingX={MODAL_PADDING_X}
            paddingY={MODAL_PADDING_Y}
            width={layout.width}
            height={layout.height}
            borderStyle="single"
            borderColor={color.border}
          >
            <Box flexDirection="column" gap={1} width="100%" height="100%">
              <Box flexDirection="column">
                <Text color={color.fg} bold>{title}</Text>
                {subtitle ? <Text color={color.muted}>{subtitle}</Text> : null}
                {layout.contentWidth > 0 ? <Text>{mutedRuleText(layout.contentWidth)}</Text> : null}
              </Box>
              <Box flexDirection="column" flexGrow={1}>
                {children}
              </Box>
              {footer ? (
                <Box>
                  {footer}
                </Box>
              ) : null}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
