import readline from "node:readline";
import path from "node:path";
import type { Runtime, RuntimeSnapshot } from "@flux-lang/core";

type SnapshotCell = RuntimeSnapshot["grids"][number]["cells"][number];

export type ViewerOptions = {
  docPath: string;
  title?: string;
  materialLabels?: Map<string, string>;
};

export async function runViewer(runtime: Runtime, options: ViewerOptions): Promise<void> {
  const materialLabels = options.materialLabels ?? new Map<string, string>();
  let snapshot = runtime.getSnapshot();

  const redraw = (snap: RuntimeSnapshot): void => {
    const grid = snap.grids[0];
    const headerTitle = options.title ? `${options.title} (${path.basename(options.docPath)})` : options.docPath;

    process.stdout.write("\x1Bc");
    console.log(headerTitle);
    if (grid) {
      console.log(`docstep ${snap.docstep} · grid ${grid.name}`);
    } else {
      console.log(`docstep ${snap.docstep}`);
    }

    const paramsStr = Object.entries(snap.params)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    console.log(`params: { ${paramsStr} }`);
    console.log("");

    if (grid) {
      for (let r = 0; r < grid.rows; r++) {
        const rowCells = grid.cells.filter((cell: SnapshotCell) => cell.row === r);
        const line = rowCells
          .map((cell: SnapshotCell) => formatCell(cell.content, materialLabels))
          .map((text: string) => text.padEnd(6, " "))
          .join(" ");
        console.log(`  ${line}`);
      }
    }

    console.log("");
    console.log("[Enter/space] step · [q] quit");
  };

  redraw(snapshot);

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  await new Promise<void>((resolve) => {
    const onKeypress = (_: string, key: readline.Key) => {
      if (key.name === "q" || (key.ctrl && key.name === "c")) {
        cleanup();
        resolve();
        return;
      }

      if (key.name === "return" || key.name === "enter" || key.name === "space") {
        const { snapshot: next } = runtime.stepDocstep();
        snapshot = next;
        redraw(snapshot);
      }
    };

    const cleanup = () => {
      process.stdin.off("keypress", onKeypress);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
    };

    process.stdin.on("keypress", onKeypress);
  });
}

function formatCell(content: string, labels: Map<string, string>): string {
  if (!content) return ".";
  const label = labels.get(content) ?? content;
  return label.slice(0, 6);
}
