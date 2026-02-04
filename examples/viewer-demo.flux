document {
  meta {
    title = "Flux Viewer Demo";
    version = "0.2.0";
  }

  pageConfig {
    size {
      width = 8.5;
      height = 11;
      units = "in";
    }
  }

  assets {
    bank demoImages {
      kind = image;
      root = "viewer-assets";
      include = "*.svg";
      tags = [ swap, demo ];
      strategy = uniform;
    }
  }

  body {
    page cover {
      section coverIntro {
        spacer coverTop { size = 140; }
        text coverTitle {
          content = "Flux Viewer Demo";
          variant = "title";
          align = "center";
        }
        text coverSubtitle {
          content = "PDF-like paged HTML with deterministic docstep evolution";
          variant = "subtitle";
          align = "center";
        }
        text coverEdition {
          variant = "edition";
          align = "center";
          text editionPrefix { content = "Edition: seed 1 · step "; }
          inline_slot editionStep {
            reserve = fixedWidth(6, ch);
            fit = ellipsis;
            refresh = onDocstep;
            text editionStepValue { content = @docstep; }
          }
          text editionMid { content = " · time "; }
          inline_slot editionTime {
            reserve = fixedWidth(7, ch);
            fit = ellipsis;
            refresh = onDocstep;
            text editionTimeValue { content = @time; }
          }
          text editionSuffix { content = "s"; }
        }
      }
    }

    page inlineProse {
      section intro {
        text paragraph1 {
          text lead { content = "Flux viewer demo shows ["; }
          inline_slot word1 {
            reserve = fixedWidth(9, ch);
            fit = ellipsis;
            refresh = onDocstep;
            text wordValue {
              content = @chooseStep([
                "moving",
                "adaptive",
                "dynamic",
                "live",
                "evolving",
                "procedural",
                "generative"
              ]);
            }
          }
          text tail { content = "] text updates without reflow."; }
        }
      }
    }

    page hero {
      section heroFigure {
        text heroHeading { content = "Figure slot"; variant = "heading"; }
        slot imageSlot {
          reserve = fixed(360, 240, px);
          fit = scaleDown;
          refresh = onDocstep;
          image heroImg { asset = @assets.pick(tags=["swap"]); }
        }
        text heroCaption {
          content = "Figure 1. Swapped SVG asset inside a fixed frame.";
          variant = "caption";
        }
        text heroCredit {
          content = "Credit: local viewer-assets/*.svg";
          variant = "credit";
        }
      }
    }

    page fitMatrix {
      section matrixIntro {
        text matrixHeading { content = "Fit policy matrix"; variant = "heading"; }
        row matrixRow1 {
          column matrixCol1 {
            text labelClip { content = "clip"; variant = "label"; }
            slot clipSlot {
              reserve = fixed(240, 56, px);
              fit = clip;
              refresh = onDocstep;
              text clipText {
                content = @chooseStep([
                  "Fits cleanly.",
                  "This sentence is intentionally long to overflow the reserved box."
                ]);
              }
            }
          }
          column matrixCol2 {
            text labelEllipsis { content = "ellipsis"; variant = "label"; }
            slot ellipsisSlot {
              reserve = fixed(240, 56, px);
              fit = ellipsis;
              refresh = onDocstep;
              text ellipsisText {
                content = @chooseStep([
                  "Fits cleanly.",
                  "This sentence is intentionally long to overflow the reserved box."
                ]);
              }
            }
          }
        }
        row matrixRow2 {
          column matrixCol3 {
            text labelShrink { content = "shrink"; variant = "label"; }
            slot shrinkSlot {
              reserve = fixed(240, 56, px);
              fit = shrink;
              refresh = onDocstep;
              text shrinkText {
                content = @chooseStep([
                  "Fits cleanly.",
                  "This sentence is intentionally long to overflow the reserved box."
                ]);
              }
            }
          }
          column matrixCol4 {
            text labelScale { content = "scaleDown"; variant = "label"; }
            slot scaleSlot {
              reserve = fixed(240, 56, px);
              fit = scaleDown;
              refresh = onDocstep;
              text scaleText {
                content = @chooseStep([
                  "Fits cleanly.",
                  "This sentence is intentionally long to overflow the reserved box."
                ]);
              }
            }
          }
        }
      }
    }

    page typography {
      section typeIntro {
        text typeHeading { content = "Typography stress"; variant = "heading"; }
        text para1 {
          content = "This page stresses justification and hyphenation in a compact measure. Deterministic layout makes subtle spacing differences obvious, especially when long technical words stretch the line or demand discretionary breaks.";
        }
        text para2 {
          content = "Microtypography benefits from consistent kerning, ligatures, and measured word spacing across dense paragraphs. When a renderer misses kerning pairs the rhythm of the line degrades, so we watch carefully for collisions and awkward gaps.";
        }
        text kerningSample {
          content = "AVATAR  WaTo  ToVA  LY";
          variant = "sample";
        }
        text hyphenBait {
          content = "electroencephalographically, characteristically, interoperability";
          variant = "sample";
        }
        spacer listSpacer { size = 40; }
        text listItem1 { content = "1. First numbered item begins late to force a continuation."; variant = "list"; }
        text listItem2 { content = "2. Second item ends this page and continues below."; variant = "list"; }
        text listNote { content = "Continued on next page."; variant = "note"; }
      }
    }

    page pagination {
      section listContinue {
        text listItem3 { content = "3. Third item continues the list across the page break."; variant = "list"; }
        text listItem4 { content = "4. Fourth item keeps the sequence intact for pagination tests."; variant = "list"; }
        text listItem5 { content = "5. Fifth item closes the numbered series."; variant = "list"; }
      }
      spacer lateSpacer { size = 220; }
      section lateBlock {
        text lateHeading { content = "Late heading near the footer"; variant = "heading"; }
        text latePara {
          content = "A short paragraph begins dangerously close to the bottom margin, tempting widows and orphans if layout control slips. The renderer should honor the page boundaries while keeping the measure intact.";
        }
        text endLine { content = "The end."; variant = "end"; }
      }
    }
  }
}
