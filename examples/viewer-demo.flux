document {
  meta {
    title = "Flux Viewer Demo";
    version = "0.3.0";
  }

  pageConfig {
    size {
      width = 8.5;
      height = 11;
      units = "in";
    }
  }

  tokens {
    font.serif = "Iowan Old Style, Palatino Linotype, Palatino, Times New Roman, serif";
    font.mono = "Source Code Pro, Courier New, monospace";
    color.text = "#1d1b17";
    color.muted = "#6b645a";
    color.link = "#2b4c7e";
    color.calloutBg = "#f6f1e8";
    color.calloutBorder = "#d9d0c4";
    space.xs = 2;
    space.s = 4;
    space.m = 8;
    space.l = 12;
    space.xl = 18;
    rule.thin = 1;
  }

  styles {
    Body {
      font.family = @tokens.font.serif;
      font.size = 10.8;
      line.height = 1.45;
      color = @tokens.color.text;
      space.after = @tokens.space.m;
    }

    H1 : Body {
      font.size = 16.5;
      font.weight = 600;
      space.before = @tokens.space.l;
      space.after = @tokens.space.s;
    }

    H2 : Body {
      font.size = 13;
      font.weight = 600;
      space.before = @tokens.space.m;
      space.after = @tokens.space.s;
    }

    Title : H1 {
      font.size = 26;
      letter.spacing = "0.02em";
      space.after = @tokens.space.s;
    }

    Subtitle : Body {
      font.size = 12.5;
      color = @tokens.color.muted;
      space.after = @tokens.space.m;
    }

    Byline : Body {
      font.size = 9.5;
      letter.spacing = "0.08em";
      text.transform = "uppercase";
      color = @tokens.color.muted;
    }

    Abstract : Body {
      color = @tokens.color.muted;
    }

    Keywords : Body {
      font.size = 9;
      letter.spacing = "0.06em";
      text.transform = "uppercase";
      color = @tokens.color.muted;
    }

    Caption : Body {
      font.size = 9.5;
      color = @tokens.color.muted;
      space.before = @tokens.space.s;
      space.after = @tokens.space.xs;
    }

    Credit : Body {
      font.size = 8.5;
      color = @tokens.color.muted;
    }

    Code : Body {
      font.family = @tokens.font.mono;
      font.size = 9.5;
      background = "#f4f0e9";
      padding = @tokens.space.s;
      border.radius = 6;
    }

    Quote : Body {
      font.style = "italic";
      color = @tokens.color.muted;
    }

    Callout : Body {
      background = @tokens.color.calloutBg;
      border = "1pt solid #d9d0c4";
      padding = 10;
      border.radius = 6;
    }
  }

  theme "print" {
    tokens {
      color.link = "#000000";
      color.calloutBg = "#f9f7f3";
    }
  }

  theme "screen" {
    tokens {
      color.link = "#2b4c7e";
      color.calloutBg = "#f1ece3";
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
        spacer coverTop { size = 120; }
        text coverTitle { role = "title"; align = "center"; content = "Flux v0.3 Viewer Demo"; }
        text coverSubtitle {
          role = "subtitle";
          align = "center";
          content = "LaTeX-grade layout, deterministic evolution, and rich text";
        }
        text coverByline { role = "byline"; align = "center"; content = "Prepared for the Flux document renderer"; }
        text coverEdition {
          role = "byline";
          align = "center";
          text editionPrefix { content = "Edition: seed 1 · step "; }
          inline_slot editionStep {
            reserve = fixedWidth(6, ch);
            fit = ellipsis;
            refresh = docstep;
            text editionStepValue { content = @docstep; }
          }
          text editionMid { content = " · time "; }
          inline_slot editionTime {
            reserve = fixedWidth(7, ch);
            fit = ellipsis;
            refresh = every("1s");
            text editionTimeValue { content = @time; }
          }
          text editionSuffix { content = "s"; }
        }
        spacer coverSpacer { size = 22; }
        text abstractLabel { style = "H2"; content = "Abstract"; }
        text abstractBody {
          role = "abstract";
          content = "Flux renders paged HTML with deterministic slot evolution, ensuring layout stability while content evolves across docsteps. v0.3 introduces structured rich text, themes, and cross-reference primitives tuned for print-like output.";
        }
        text keywordsLabel { style = "H2"; content = "Keywords"; }
        text keywordsBody {
          role = "keywords";
          content = "deterministic rendering · slots · styles · assets · cross-refs";
        }
      }
    }

    page richProse {
      section intro {
        text paragraph1 {
          text lead { content = "Flux now supports "; }
          em em1 { content = "emphasis"; }
          text mid1 { content = ", "; }
          strong strong1 { content = "strong"; }
          text mid2 { content = ", "; }
          code code1 { content = "inline code"; }
          text mid3 { content = ", "; }
          link link1 { href = "https://example.com"; content = "links"; }
          text mid4 { content = ", and "; }
          mark mark1 { content = "highlight"; }
          text mid5 { content = ". Small "; }
          smallcaps sc1 { content = "caps"; }
          text mid6 { content = " meet sub"; }
          sub sub1 { content = "2"; }
          text mid7 { content = " and sup"; }
          sup sup1 { content = "3"; }
          text mid8 { content = ", plus "; }
          quote q1 { content = "inline quotes"; }
          text mid9 { content = "."; }
          text mid10 { content = " Live descriptor: "; }
          inline_slot pill {
            reserve = fixedWidth(9, ch);
            fit = ellipsis;
            refresh = every("1.2s");
            transition = fade(duration=220ms, ease="inOut");
            text pillValue {
              content = @cycle([
                "moving",
                "adaptive",
                "dynamic",
                "live",
                "procedural",
                "stochastic"
              ], index=time / 1.2);
            }
          }
          text tail { content = " text updates without reflow."; }
        }
      }
    }

    page hero {
      section heroFigure {
        text heroHeading { style = "H1"; content = "Figure slot"; }
        text heroRef { content = @("See " + ref("fig:hero") + " for the live asset swap."); }
        figure heroFig {
          label = "fig:hero";
          slot imageSlot {
            reserve = fixed(360, 240, px);
            fit = scaleDown;
            refresh = poisson(ratePerSec=0.15);
            transition = wipe(direction="left", duration=280ms, ease="inOut");
            image heroImg { asset = @assets.pick(tags=["swap"]); }
          }
          text heroCaption {
            role = "caption";
            content = @(ref("fig:hero") + ". Swapped SVG asset inside a fixed frame.");
          }
          text heroCredit {
            role = "credit";
            content = "Credit: local viewer-assets/*.svg";
          }
        }
      }
    }

    page fitMatrix {
      section matrixIntro {
        text matrixHeading { style = "H1"; content = "Fit policy matrix"; }
        row matrixRow1 {
          column matrixCol1 {
            text labelClip { style = "H2"; content = "clip"; }
            slot clipSlot {
              reserve = fixed(240, 56, px);
              fit = clip;
              refresh = every("2s");
              text clipText {
                content = @chooseStep([
                  "Fits cleanly.",
                  "This sentence is intentionally long to overflow the reserved box."
                ]);
              }
            }
          }
          column matrixCol2 {
            text labelEllipsis { style = "H2"; content = "ellipsis"; }
            slot ellipsisSlot {
              reserve = fixed(240, 56, px);
              fit = ellipsis;
              refresh = every("2s");
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
            text labelShrink { style = "H2"; content = "shrink"; }
            slot shrinkSlot {
              reserve = fixed(240, 56, px);
              fit = shrink;
              refresh = every("2s");
              text shrinkText {
                content = @chooseStep([
                  "Fits cleanly.",
                  "This sentence is intentionally long to overflow the reserved box."
                ]);
              }
            }
          }
          column matrixCol4 {
            text labelScale { style = "H2"; content = "scaleDown"; }
            slot scaleSlot {
              reserve = fixed(240, 56, px);
              fit = scaleDown;
              refresh = every("2s");
              text scaleText {
                content = @chooseStep([
                  "Fits cleanly.",
                  "This sentence is intentionally long to overflow the reserved box."
                ]);
              }
            }
          }
        }
        row timedRow {
          column timedCol1 {
            text labelReveal { style = "H2"; content = "delayed reveal"; }
            slot revealSlot {
              reserve = fixed(200, 48, px);
              fit = clip;
              refresh = at("3s");
              transition = appear();
              text revealText { content = @cycle(["", "Revealed"], index=time / 3); }
            }
          }
          column timedCol2 {
            text labelFlash { style = "H2"; content = "flash"; }
            slot flashSlot {
              reserve = fixed(200, 48, px);
              fit = clip;
              refresh = chance(p=0.05, every="250ms");
              transition = flash(duration=120ms);
              text flashText {
                content = @choose(["pulse", "glint", "spark"]);
              }
            }
          }
        }
        callout invariants {
          tone = "note";
          text calloutBody {
            content = "Slots reserve geometry and fit dynamic content without reflow. Only slot interiors change on refresh ticks; neighboring layout remains fixed.";
          }
        }
        table policyTable {
          rows = [
            ["Policy", "Behavior"],
            ["clip", "Hard clip without resizing"],
            ["ellipsis", "Single-line truncation"],
            ["shrink", "Reduce font size to fit"],
            ["scaleDown", "Scale inner content to fit"]
          ];
          header = true;
        }
      }
    }

    page typography {
      section typeIntro {
        text typeHeading { style = "H1"; content = "Typography stress"; }
        text para1 {
          content = "This page stresses justification and hyphenation in a compact measure. Deterministic layout makes subtle spacing differences obvious, especially when long technical words stretch the line or demand discretionary breaks.";
        }
        text para2 {
          content = "Microtypography benefits from consistent kerning, ligatures, and measured word spacing across dense paragraphs. When a renderer misses kerning pairs the rhythm of the line degrades, so we watch carefully for collisions and awkward gaps.";
        }
        text kerningSample { style = "Sample"; content = "AVATAR  WaTo  ToVA  LY"; }
        text hyphenBait { style = "Sample"; content = "electroencephalographically, characteristically, interoperability"; }
        blockquote bq1 { text bqText { content = "A block quote holds the line and keeps a steady tempo under pressure."; } }
        codeblock code1 {
          content = "function fit(text) {\n  return text.length < 42 ? text : text.slice(0, 42);\n}";
        }
        spacer listSpacer { size = 40; }
        text listNote { content = "Numbered list continues on the next page."; }
        ol listA {
          li li1 { text t1 { content = "First numbered item begins late to force a continuation."; } }
          li li2 { text t2 { content = "Second item ends this page and continues below."; } }
        }
      }
    }

    page pagination {
      section listContinue {
        ol listB {
          start = 3;
          li li3 { text t3 { content = "Third item continues the list across the page break."; } }
          li li4 { text t4 { content = "Fourth item keeps the sequence intact for pagination tests."; } }
          li li5 { text t5 { content = "Fifth item closes the numbered series."; } }
        }
      }
      spacer lateSpacer { size = 210; }
      section lateBlock {
        text lateHeading { style = "H2"; content = "Late heading near the footer"; }
        text latePara {
          content = "A short paragraph begins dangerously close to the bottom margin, tempting widows and orphans if layout control slips. The renderer should honor the page boundaries while keeping the measure intact.";
        }
        text footnoteLine {
          content = "Footnote demo";
          footnote fnDesign { label = "fn:design"; content = "Footnotes are collected at the page end (not yet page-aware)."; }
        }
        text endLine { style = "End"; content = "The end."; }
      }
      section screenOnly {
        visibleIf = @meta.target == "screen";
        callout screenCallout {
          tone = "info";
          text screenNote { content = "Screen-only addendum: this section is hidden in print theme."; }
        }
      }
      include appendixA {
        path = "chapters/appendix-a.flux";
        visibleIf = @meta.target == "screen";
      }
    }
  }
}
