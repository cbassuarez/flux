import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDocument, createDocumentRuntimeIR } from "@flux-lang/core";
import { advanceViewerRuntime, startViewerServer } from "../src/index";

describe("viewer server", () => {
  const networkDisabled = process.env.CODEX_SANDBOX_NETWORK_DISABLED === "1";
  const itNetwork = networkDisabled ? it.skip : it;

  it("advances time and docstep on the wallclock tick", () => {
    const source = `
      document {
        meta { version = "0.2.0"; }
        body {
          page p1 {
            slot s1 {
              reserve = fixed(120, 32, px);
              refresh = every(1s);
              text t1 { content = @"t=" + time; }
            }
          }
        }
      }
    `;

    const doc = parseDocument(source);
    const runtime = createDocumentRuntimeIR(doc, { seed: 1 });
    const initial = runtime.render();

    const tick1 = advanceViewerRuntime(runtime, {}, true, 0.5, 1);
    const tick2 = advanceViewerRuntime(runtime, {}, true, 0.5, 1);

    expect(tick1.ir.docstep).toBe(initial.docstep + 1);
    expect(tick2.ir.docstep).toBe(initial.docstep + 2);
    expect(tick2.ir.time).toBeGreaterThan(initial.time);
    expect(tick2.ir.time).toBeCloseTo(1, 4);
  });

  itNetwork("applies input events and patches the affected slot", async () => {
    const source = `
      document {
        meta { version = "0.2.0"; }
        state { param score : int [0, 999] @ 0; }
        body {
          page p1 {
            slot s1 {
              reserve = fixed(120, 40, px);
              refresh = docstep;
              text t1 { content = @"score " + score; }
            }
          }
        }
        rule bump(mode = event, on = "click") {
          when true then { score = score + 10; advanceDocstep(); }
        }
        runtime { eventsApply = "immediate"; }
      }
    `;

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "flux-viewer-evt-"));
    const docPath = path.join(tmpDir, "doc.flux");
    await fs.writeFile(docPath, source);

    // No wallclock ticking: the docstep should only move because of the event.
    const server = await startViewerServer({ docPath, seed: 1, advanceTime: false });

    try {
      const postEvent = (type: string) =>
        fetch(`${server.url}/api/event`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type }),
        }).then((r) => r.json() as Promise<{ ok: boolean; docstep: number }>);

      const clickRes = await postEvent("click");
      expect(clickRes.ok).toBe(true);
      expect(clickRes.docstep).toBe(1); // event rule called advanceDocstep()

      const patches = (await (await fetch(`${server.url}/api/patches`)).json()) as {
        slotPatches?: Record<string, string>;
      };
      const slotHtml = Object.values(patches.slotPatches ?? {}).join("");
      expect(slotHtml).toContain("score 10");

      // An event with no matching rule must not advance the docstep.
      const hoverRes = await postEvent("hover");
      expect(hoverRes.docstep).toBe(1);
    } finally {
      await server.close();
    }
  });

  itNetwork("streams slot patches over SSE", async () => {
    const source = `
      document {
        meta { version = "0.2.0"; }
        body {
          page p1 {
            slot s1 {
              reserve = fixed(120, 40, px);
              refresh = docstep;
              text t1 { content = @"step " + docstep; }
            }
          }
        }
      }
    `;

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "flux-viewer-"));
    const docPath = path.join(tmpDir, "doc.flux");
    await fs.writeFile(docPath, source);

    const server = await startViewerServer({ docPath, docstepMs: 40, seed: 1, advanceTime: true });

    const events: any[] = [];
    let buffer = "";
    let req: http.ClientRequest | null = null;

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timed out waiting for SSE")), 1000);
        const parseBuffer = () => {
          let idx = buffer.indexOf("\n\n");
          while (idx !== -1) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const dataLines = chunk
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.replace(/^data:\s?/, ""));
            if (dataLines.length) {
              try {
                events.push(JSON.parse(dataLines.join("\n")));
              } catch {
                // ignore parse errors
              }
            }
            idx = buffer.indexOf("\n\n");
          }
          if (events.length >= 3) {
            clearTimeout(timeout);
            resolve();
          }
        };

        req = http.request(`${server.url}/api/stream`, (res) => {
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            buffer += chunk;
            parseBuffer();
          });
          res.on("error", reject);
        });
        req.on("error", reject);
        req.end();
      });
    } finally {
      if (req) req.destroy();
      await server.close();
    }

    const [first, second, third] = events;
    expect(first).toBeTruthy();
    expect(second.docstep).toBeGreaterThan(first.docstep);
    expect(third.docstep).toBeGreaterThan(second.docstep);
    expect(third.time).toBeGreaterThanOrEqual(second.time);
    const patchKeys = Object.keys(second.slotPatches ?? {});
    expect(patchKeys.some((key) => key.includes("/slot:s1"))).toBe(true);
    expect(second.slotMeta).toBeTruthy();
    if (second.slotMeta) {
      const metaEntry = Object.entries(second.slotMeta)[0]?.[1];
      expect(metaEntry && metaEntry.valueHash).toBeTruthy();
    }
  });
});
