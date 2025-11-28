import readline from "node:readline";
import { computeGridLayout, getDocstepIntervalHint } from "@flux-lang/core";
import type { Runtime, RuntimeSnapshot } from "@flux-lang/core";

interface ViewerOptions {
  docPath: string;
  title?: string;
  materialLabels?: Map<string, string>;
}

export async function runViewer(runtime: Runtime, options: ViewerOptions): Promise<void> {
  const materialLabels = options.materialLabels ?? new Map<string, string>();
  let snapshot = runtime.snapshot();
  let autoplay = false;
  let autoplayTimer: ReturnType<typeof setInterval> | null = null;

  const headerTitle = options.title ? `${options.title} (${options.docPath})` : options.docPath;

  const render = (snap: RuntimeSnapshot): void => {
    process.stdout.write("\x1b[2J\x1b[H");
    console.log("Flux viewer");
    console.log(headerTitle);
    const hint = getDocstepIntervalHint(runtime.doc, runtime.state);
    console.log(`Docstep ${snap.docstep}${hint.ms ? ` · timer hint ${hint.ms} ms` : ""}`);
    console.log("Press [enter] to step, [space] to toggle autoplay, [q] to quit.");
    console.log("");

    const layout = computeGridLayout(runtime.doc, snap);
    for (const grid of layout.grids) {
      console.log(`grid ${grid.name} (${grid.rows} x ${grid.cols}), docstep ${layout.docstep}`);
      const lines: string[][] = Array.from({ length: grid.rows }, () => Array(grid.cols).fill("."));

      for (const cell of grid.cells) {
        const ch = formatCell(cell.content, cell.tags, materialLabels);
        if (cell.row < grid.rows && cell.col < grid.cols) {
          lines[cell.row][cell.col] = ch;
        }
      }

      for (const row of lines) {
        console.log(` ${row.join("  ")}`);
      }
      console.log("");
    }
  };

  const stopAutoplay = (): void => {
    autoplay = false;
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  };

  const startAutoplay = (): void => {
    if (autoplay) return;
    autoplay = true;
    autoplayTimer = setInterval(() => {
      snapshot = runtime.step();
      render(snapshot);
    }, 700);
  };

  render(snapshot);

  readline.emitKeypressEvents(process.stdin);
  const wasRaw = process.stdin.isTTY ? process.stdin.isRaw : false;
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  try {
    await new Promise<void>((resolve) => {
      const cleanup = (): void => {
        process.stdin.off("keypress", onKeypress);
      };

      const onKeypress = (_: string, key: readline.Key) => {
        if (key.name === "q" || (key.ctrl && key.name === "c")) {
          stopAutoplay();
          cleanup();
          resolve();
          return;
        }

        if (key.name === "r") {
          stopAutoplay();
          snapshot = runtime.reset();
          render(snapshot);
          return;
        }

        if (key.name === "space") {
          if (autoplay) {
            stopAutoplay();
          } else {
            startAutoplay();
          }
          return;
        }

        if (key.name === "return" || key.name === "enter" || key.sequence === "\n") {
          if (!autoplay) {
            snapshot = runtime.step();
            render(snapshot);
          }
        }
      };

      process.stdin.on("keypress", onKeypress);
    });
  } finally {
    stopAutoplay();
    process.stdin.removeAllListeners("keypress");
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(Boolean(wasRaw));
    }
  }
}

function formatCell(content: string | undefined, tags: string[], labels: Map<string, string>): string {
  const value = content ?? "";
  const labelChar = labels.get(value)?.[0];
  if (labelChar) return labelChar.toUpperCase();

  const tagSet = new Set(tags);
  if (value === "seed" || tagSet.has("seed")) return "S";
  if (value === "pulse" || tagSet.has("pulse")) return "P";
  if (value === "noise" || tagSet.has("noise")) return "N";
  if (value) return value.slice(0, 1).toUpperCase();
  return ".";
}
