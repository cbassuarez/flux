/// Interactive counter — an event-driven, reactive document.
///
/// Demonstrates the runtime kernel's event handling end to end: a "click"
/// event runs an event-mode rule that mutates state and advances a docstep,
/// a docstep rule derives the level, and docstep-refreshing slots re-render
/// the new values. In the viewer (`flux view`), POST to /api/event with
/// {"type":"click"} drives it; see examples/verify.mjs for a headless check.
document {
  meta {
    title   = "Interactive Counter";
    version = "0.3.0";
  }

  state {
    param score : int [0, 9999] @ 0;
    param level : int [1, 99] @ 1;
  }

  body {
    page p1 {
      section s {
        text heading { content = "Click Counter"; }
        text scoreLine {
          text scorePrefix { content = "Score: "; }
          inline_slot scoreSlot {
            reserve = fixedWidth(6, ch);
            fit     = ellipsis;
            refresh = docstep;
            text scoreValue { content = @score; }
          }
          text levelPrefix { content = "   ·   Level "; }
          inline_slot levelSlot {
            reserve = fixedWidth(3, ch);
            fit     = ellipsis;
            refresh = docstep;
            text levelValue { content = @level; }
          }
        }
      }
    }
  }

  /// Each click adds to the score and advances a docstep so the derived
  /// rules run and the slots refresh.
  rule click(mode = event, on = "click") {
    when true then {
      score = score + 10;
      advanceDocstep();
    }
  }

  /// Level rises every 50 points. Runs on each docstep.
  rule levelUp(mode = docstep) {
    when score >= level * 50 then {
      level = level + 1;
    }
  }

  runtime {
    eventsApply = "immediate";
  }
}
