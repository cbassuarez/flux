document {
  meta {
    title = "CLI Edit Fixture";
    version = "0.1.0";
  }

  page page1 {
    section section1 {
      text text1 { content = "Hello world"; }
      figure fig1 {
        caption = "Initial caption";
      }
      slot slot1 {
        reserve = "fixedWidth(8, ch)";
        fit = "ellipsis";
        content = @choose(["alpha", "beta"]);
      }
    }
  }
}
