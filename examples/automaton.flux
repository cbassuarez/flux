/// Spark automaton — a grid that evolves under docstep rules.
///
/// Demonstrates the runtime kernel executing the full rule calculus:
/// `let` bindings, multi-branch (`when … else when … else`), neighbour
/// aggregates, and the deterministic math stdlib (min/max). Render it at
/// different --docstep values to watch the sparks spread and decay:
///
///   flux render --format ir examples/automaton.flux --docstep 0
///   flux render --format ir examples/automaton.flux --docstep 3
document {
  meta {
    title   = "Spark Automaton";
    version = "0.3.0";
  }

  state {
    /// How much a lit cell cools each docstep.
    param decay : float [0.0, 1.0] @ 0.34;
    /// Neighbour energy (averaged) needed for an empty cell to ignite.
    param threshold : float [0.0, 1.0] @ 0.18;
  }

  grid field {
    topology = grid;
    size { rows = 3; cols = 6; }

    cell c00 { tags = [ spark ]; content = "*"; dynamic = 1.0; }
    cell c01 { tags = [ cell ];  content = "";  dynamic = 0.0; }
    cell c02 { tags = [ cell ];  content = "";  dynamic = 0.0; }
    cell c03 { tags = [ cell ];  content = "";  dynamic = 0.0; }
    cell c04 { tags = [ cell ];  content = "";  dynamic = 0.0; }
    cell c05 { tags = [ spark ]; content = "*"; dynamic = 1.0; }

    cell c10 { tags = [ cell ];  content = "";  dynamic = 0.0; }
    cell c11 { tags = [ cell ];  content = "";  dynamic = 0.0; }
    cell c12 { tags = [ cell ];  content = "";  dynamic = 0.0; }
    cell c13 { tags = [ cell ];  content = "";  dynamic = 0.0; }
    cell c14 { tags = [ cell ];  content = "";  dynamic = 0.0; }
    cell c15 { tags = [ cell ];  content = "";  dynamic = 0.0; }

    cell c20 { tags = [ spark ]; content = "*"; dynamic = 1.0; }
    cell c21 { tags = [ cell ];  content = "";  dynamic = 0.0; }
    cell c22 { tags = [ cell ];  content = "";  dynamic = 0.0; }
    cell c23 { tags = [ cell ];  content = "";  dynamic = 0.0; }
    cell c24 { tags = [ cell ];  content = "";  dynamic = 0.0; }
    cell c25 { tags = [ spark ]; content = "*"; dynamic = 1.0; }
  }

  runtime {
    docstepAdvance = [ timer(1s) ];
  }

  /// An empty cell ignites from energetic neighbours; lit cells cool and
  /// eventually go dark. Last branch keeps cooled cells empty.
  rule evolve(mode = docstep, grid = field) {
    when cell.content == "" and neighbors.all().dynamic > threshold then {
      let inflow = neighbors.all().dynamic;
      cell.content = "*";
      cell.dynamic = min(1.0, inflow + 0.25);
    }
    else when cell.dynamic > 0.0 then {
      cell.dynamic = max(0.0, cell.dynamic - decay);
    }
    else {
      cell.content = "";
    }
  }
}
