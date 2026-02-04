document {
  meta {
    title = "Viewer Demo";
    version = "0.2.0";
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
    page p1 {
      section intro {
        text paragraph1 {
          text lead { content = "Flux viewer demo shows "; }
          inline_slot word1 {
            reserve = fixedWidth(140, px);
            fit = ellipsis;
            refresh = onDocstep;
            text t1 { content = @choose(["dynamic", "live", "adaptive", "moving"]); }
          }
          text tail { content = " text updates without reflow."; }
        }

        text paragraph2 {
          content = "This paragraph remains fixed while the inline slot updates on each docstep.";
        }
      }

      section hero {
        slot imageSlot {
          reserve = fixed(320, 200, px);
          fit = scaleDown;
          refresh = onDocstep;
          image heroImg { asset = @assets.pick(tags=[swap]); }
        }
        text caption {
          content = "Image slot swaps per docstep without changing layout.";
        }
      }
    }
  }
}
