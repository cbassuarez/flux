document {
  meta { version = "0.3.0"; }
  body {
    section appendixA {
      text appendixHeading { style = "H2"; content = "Appendix A · Screen-only Notes"; }
      text appendixBody {
        content = "This appendix is included from a separate file to demonstrate sandboxed includes. It can be toggled by theme and remains deterministic across docsteps.";
      }
    }
  }
}
