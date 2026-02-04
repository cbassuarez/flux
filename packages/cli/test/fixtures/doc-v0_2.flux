document {
  meta {
    title = "Render Test";
    version = "0.2.0";
  }

  assets {
    asset hero {
      kind = image;
      path = "img/hero.png";
      tags = [ hero ];
    }
  }

  body {
    page p1 {
      text t1 { content = "Hello"; }
      image i1 { asset = @assets.pick(tags=[hero]); }
    }
  }
}
