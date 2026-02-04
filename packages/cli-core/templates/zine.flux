document {
  meta {
    title = "{{TITLE}}";
    version = "0.3.0";
    target = "{{THEME}}";
  }

  pageConfig {
    size { width = {{WIDTH}}; height = {{HEIGHT}}; units = "{{UNITS}}"; }
  }

  body {
    page zine {
      text title { style = "Title"; content = "{{TITLE}}"; }
      text subtitle { style = "Subtitle"; content = "Zine layout"; }
    }
  }
}
