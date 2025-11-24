document {
  state {
    param docstep : int [0, inf] @ 0;
  }

  rule growNoise(mode = docstep, grid = main) {
    when docstep == 0
    then {
      docstep = 1;
    }
  }
}

