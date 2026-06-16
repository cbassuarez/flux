// Set the theme before first paint to avoid a flash of the wrong theme.
// Kept as an external file (not inline) so it complies with the editor's
// Content-Security-Policy (`script-src 'self'`).
(function () {
  try {
    var stored = localStorage.getItem("flux.theme");
    var theme =
      stored === "dark" || stored === "light" || stored === "blueprint"
        ? stored
        : window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.dataset.theme = theme;
  } catch (err) {
    // Ignore theme boot failures.
  }
})();
