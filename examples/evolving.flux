/// Evolving poster — deterministic evolution through slots and generators.
///
/// No rules here: the document itself re-evaluates slot content as the
/// docstep and time advance. `chooseStep` is a pure function of the docstep,
/// so the headline cycles deterministically; the ticker refreshes on a timer.
/// Render at different docsteps to see it change, byte-for-byte reproducibly:
///
///   flux render --format ir examples/evolving.flux --docstep 0
///   flux render --format ir examples/evolving.flux --docstep 2
document {
  meta {
    title   = "Evolving Poster";
    version = "0.3.0";
  }

  body {
    page p1 {
      section s {
        text label { content = "Now showing"; }
        text headlineLine {
          inline_slot headline {
            reserve = fixedWidth(12, ch);
            fit     = ellipsis;
            refresh = docstep;
            text headlineValue {
              content = @chooseStep(["Sunrise", "Zenith", "Dusk", "Midnight"]);
            }
          }
        }
        text tickerLine {
          text tickerPrefix { content = "elapsed "; }
          inline_slot ticker {
            reserve = fixedWidth(8, ch);
            fit     = ellipsis;
            refresh = every("1s");
            text tickerValue { content = @"t=" + time; }
          }
        }
      }
    }
  }
}
