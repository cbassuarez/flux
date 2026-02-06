import { describe, expect, it } from "vitest";
import {
  buildAddCalloutTransform,
  buildAddFigureTransform,
  buildAddParagraphTransform,
  buildAddSectionTransform,
  buildAddSlotTransform,
  buildAddTableTransform,
  buildSetTextTransform
} from "./transforms";

describe("transform builders", () => {
  it("builds addSection transform", () => {
    expect(buildAddSectionTransform()).toEqual({ op: "addSection", args: { heading: undefined, noHeading: undefined } });
    expect(buildAddSectionTransform({ heading: "Intro", noHeading: true })).toEqual({
      op: "addSection",
      args: { heading: "Intro", noHeading: true }
    });
  });

  it("builds addParagraph transform", () => {
    expect(buildAddParagraphTransform("New para")).toEqual({ op: "addParagraph", args: { text: "New para" } });
  });

  it("builds addFigure transform with cleaned args", () => {
    const transform = buildAddFigureTransform({
      bankName: "  hero-bank  ",
      tags: [" cover ", "", "poster"],
      caption: "  ",
      reserve: "640x360",
      fit: "contain"
    });

    expect(transform.op).toBe("addFigure");
    expect(transform.args).toEqual({
      bankName: "hero-bank",
      tags: ["cover", "poster"],
      caption: undefined,
      reserve: "640x360",
      fit: "contain"
    });
  });

  it("builds addCallout and addTable transforms", () => {
    expect(buildAddCalloutTransform("Heads up", "warning")).toEqual({
      op: "addCallout",
      args: { text: "Heads up", tone: "warning" }
    });
    expect(buildAddTableTransform()).toEqual({ op: "addTable", args: {} });
    expect(buildAddSlotTransform()).toEqual({ op: "addSlot", args: {} });
  });

  it("builds setText transform", () => {
    expect(buildSetTextTransform({ id: "node1", text: "Updated" })).toEqual({
      op: "setText",
      args: { id: "node1", text: "Updated" }
    });
  });
});
