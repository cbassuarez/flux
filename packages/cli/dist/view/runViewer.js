import readline from "node:readline";
import path from "node:path";
export async function runViewer(runtime, options) {
    const materialLabels = options.materialLabels ?? new Map();
    let snapshot = runtime.getSnapshot();
    const redraw = (snap) => {
        const grid = snap.grids[0];
        const headerTitle = options.title ? `${options.title} (${path.basename(options.docPath)})` : options.docPath;
        process.stdout.write("\x1Bc");
        console.log(headerTitle);
        if (grid) {
            console.log(`docstep ${snap.docstep} · grid ${grid.name}`);
        }
        else {
            console.log(`docstep ${snap.docstep}`);
        }
        const paramsStr = Object.entries(snap.params)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ");
        console.log(`params: { ${paramsStr} }`);
        console.log("");
        if (grid) {
            for (let r = 0; r < grid.rows; r++) {
                const rowCells = grid.cells.filter((cell) => cell.row === r);
                const line = rowCells
                    .map((cell) => formatCell(cell.content, materialLabels))
                    .map((text) => text.padEnd(6, " "))
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
    await new Promise((resolve) => {
        const onKeypress = (_, key) => {
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
function formatCell(content, labels) {
    if (!content)
        return ".";
    const label = labels.get(content) ?? content;
    return label.slice(0, 6);
}
