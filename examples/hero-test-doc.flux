document {
  meta {
    title   = "Hero Test Patch";
    version = "0.1.0";
  }

  state {
    /// Global tempo in BPM
    param tempo : float [40, 160] @ 96;

    /// Probability that a new cell will start pulsing on each docstep
    param spawnProb : float [0.0, 1.0] @ 0.3;
  }

  grid main {
    topology = grid;

    size {
      rows = 2;
      cols = 4;
    }

    cell c1 {
      tags    = [ seed, pulse ];
      content = "seed";
      dynamic = 0.9;
    }

    cell c2 {
      tags    = [ pulse ];
      content = "";
      dynamic = 0.0;
    }

    cell c3 {
      tags    = [ pulse ];
      content = "";
      dynamic = 0.0;
    }

    cell c4 {
      tags    = [ pulse ];
      content = "";
      dynamic = 0.0;
    }

    cell c5 {
      tags    = [ noise ];
      content = "";
      dynamic = 0.0;
    }

    cell c6 {
      tags    = [ noise ];
      content = "";
      dynamic = 0.0;
    }

    cell c7 {
      tags    = [ noise ];
      content = "";
      dynamic = 0.0;
    }

    cell c8 {
      tags    = [ noise ];
      content = "";
      dynamic = 0.0;
    }
  }

  runtime {
    /// Advance one docstep every eight seconds by default.
    docstepAdvance = [ timer(8s) ];
    eventsApply    = "deferred";
  }

  materials {
    material pulseSeed {
      tags        = [ pulse, seed ];
      label       = "pulse";
      description = "Seeded pulse material.";
      color       = "#00CDFE";

      score {
        text  = "mf, sul tasto, senza attacco, → pp";
        staff = "vn1";
      }

      midi {
        channel        = 1;
        pitch          = 72;
        velocity       = 80;
        durationSeconds = 0.5;
      }

      video {
        clip       = "clips/pulse-seed.mp4";
        inSeconds  = 0.0;
        outSeconds = 2.0;
        layer      = "fg";
      }
    }

    material noiseHit {
      tags        = [ noise ];
      label       = "noise";
      description = "Short percussive noise; interpret freely.";
      color       = "#0F172A";

      score {
        text  = "short noise event";
        staff = "perc1";
      }
    }
  }

  /// Spread "pulse" content to orthogonal neighbors that are currently empty.
  rule spreadPulse(mode = docstep, grid = main) {
    when
      cell.tags.contains("pulse") and
      cell.content == "seed"
    then {
      cell.content = "pulseSeed";
      cell.dynamic = 0.7;
    }
  }

  /// Stochastically spawn noise in non-pulse cells.
  rule spawnNoise(mode = docstep, grid = main) {
    when
      not cell.tags.contains("pulse") and
      cell.content == "" and
      random() < spawnProb
    then {
      cell.content = "noiseHit";
      cell.dynamic = 0.5;
    }
  }

  /// Simple decay rule for dynamics.
  rule decayDynamics(mode = docstep, grid = main) {
    when cell.dynamic > 0.0 then {
      cell.dynamic = max(0.0, cell.dynamic - 0.05);
    }
  }
}
