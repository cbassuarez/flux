import type { TransformRequest } from "./api";

export type AddFigureArgs = {
  bankName: string;
  tags?: string[];
  caption?: string;
  reserve?: string;
  fit?: string;
};

export type SetTextArgs = {
  id: string;
  text: string;
};

export type AddSectionArgs = {
  heading?: string;
  noHeading?: boolean;
};

function cleanString(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export function buildAddSectionTransform(args: AddSectionArgs = {}): TransformRequest {
  return {
    op: "addSection",
    args: {
      heading: cleanString(args.heading),
      noHeading: typeof args.noHeading === "boolean" ? args.noHeading : undefined,
    },
  };
}

export function buildAddParagraphTransform(text?: string): TransformRequest {
  return { op: "addParagraph", args: { text: cleanString(text) } };
}

export function buildAddFigureTransform(args: AddFigureArgs): TransformRequest {
  const tags = (args.tags ?? [])
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  return {
    op: "addFigure",
    args: {
      bankName: cleanString(args.bankName),
      tags,
      caption: cleanString(args.caption),
      reserve: cleanString(args.reserve),
      fit: cleanString(args.fit)
    }
  };
}

export function buildAddCalloutTransform(text?: string, tone?: string): TransformRequest {
  return {
    op: "addCallout",
    args: {
      text: cleanString(text) ?? "Callout text.",
      tone: cleanString(tone) ?? "info"
    }
  };
}

export function buildAddTableTransform(): TransformRequest {
  return { op: "addTable", args: {} };
}

export function buildAddSlotTransform(): TransformRequest {
  return { op: "addSlot", args: {} };
}

export function buildSetTextTransform(args: SetTextArgs): TransformRequest {
  return {
    op: "setText",
    args: {
      id: args.id,
      text: args.text
    }
  };
}
