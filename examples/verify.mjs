#!/usr/bin/env node
/**
 * End-to-end verification for the example documents.
 *
 * Runs every examples/*.flux through the real engine — parse, static check,
 * deterministic render — and asserts the runtime-driven examples actually
 * evolve and react. Nothing here hand-writes IR; it all comes out of the
 * same pipeline the CLI and viewer use.
 *
 *   node examples/verify.mjs
 *
 * Requires the core package to be built (pnpm --filter @flux-lang/core build).
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseDocument,
  checkDocument,
  renderDocumentIR,
  createDocumentRuntime,
} from "../packages/core/dist/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const failures = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (name, msg) => {
  failures.push(`${name}: ${msg}`);
  console.log(`  ✗ ${msg}`);
};

const findById = (nodes, id) => {
  for (const n of nodes ?? []) {
    if (n.id === id) return n;
    const c = findById(n.children, id);
    if (c) return c;
  }
  return undefined;
};
const litCount = (ir) => (JSON.stringify(ir).match(/"content":"\*"/g) || []).length;

function checkAndRender(name, source) {
  const doc = parseDocument(source, { sourcePath: path.join(here, name) });
  const errors = checkDocument(path.join(here, name), doc);
  if (errors.length) {
    fail(name, `check errors: ${errors.join("; ")}`);
    return null;
  }
  ok("checks pass");

  // Determinism: same inputs → identical IR.
  const a = JSON.stringify(renderDocumentIR(doc, { docstep: 0, seed: 1 }));
  const b = JSON.stringify(renderDocumentIR(doc, { docstep: 0, seed: 1 }));
  if (a !== b) {
    fail(name, "render is not deterministic for the same inputs");
  } else {
    ok("renders deterministically");
  }
  return doc;
}

const behaviours = {
  "automaton.flux"(doc, name) {
    const counts = [0, 1, 2, 3].map((d) => litCount(renderDocumentIR(doc, { docstep: d })));
    if (counts[3] > counts[0]) ok(`grid evolves (lit cells ${counts.join(" → ")})`);
    else fail(name, `grid did not evolve (lit cells ${counts.join(" → ")})`);
  },
  "evolving.flux"(doc, name) {
    const heads = [0, 1, 2].map(
      (d) => findById(renderDocumentIR(doc, { docstep: d }).body, "headlineValue")?.props?.content,
    );
    if (new Set(heads).size > 1) ok(`headline cycles (${heads.join(" → ")})`);
    else fail(name, `headline did not change (${heads.join(" → ")})`);
  },
  "interactive.flux"(doc, name) {
    const rt = createDocumentRuntime(doc);
    const score = () => findById(rt.render().body, "scoreValue")?.props?.content;
    const before = score();
    rt.applyEvent({ type: "click" });
    rt.applyEvent({ type: "click" });
    const after = score();
    if (rt.lastError) fail(name, `runtime error: ${rt.lastError.message}`);
    else if (after > before) ok(`reacts to events (score ${before} → ${after})`);
    else fail(name, `did not react to events (score stayed ${before})`);
  },
};

const files = readdirSync(here).filter((f) => f.endsWith(".flux")).sort();
console.log(`Verifying ${files.length} example(s):\n`);
for (const name of files) {
  console.log(name);
  const source = readFileSync(path.join(here, name), "utf8");
  let doc;
  try {
    doc = checkAndRender(name, source);
  } catch (err) {
    fail(name, `threw: ${err.message}`);
    continue;
  }
  if (doc && behaviours[name]) {
    try {
      behaviours[name](doc, name);
    } catch (err) {
      fail(name, `behaviour check threw: ${err.message}`);
    }
  }
  console.log("");
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`All ${files.length} examples verified end to end.`);
