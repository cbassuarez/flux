# Flux examples

Real `.flux` documents that run through the same engine the CLI and viewer use.
Every one of them parses, statically checks, and renders deterministically — and
the runtime-driven ones actually evolve and react. Verify the whole set end to
end (requires `pnpm --filter @flux-lang/core build` first):

```bash
node examples/verify.mjs
```

| Example | Shows | Engine path |
| --- | --- | --- |
| [`article.flux`](article.flux) | LaTeX-like paged document (scaffolded with `flux new article`). | Document model |
| [`viewer-demo.flux`](viewer-demo.flux) | 6-page showcase: styles, tokens, themes, slots, assets, cross-refs, includes. | Document model + evolution |
| [`evolving.flux`](evolving.flux) | Slots that re-evaluate by docstep/time via generators — no rules, fully deterministic. | Document evaluator |
| [`automaton.flux`](automaton.flux) | A grid that evolves under docstep rules: `let`, multi-branch, neighbour aggregates, `min`/`max`. | Runtime kernel |
| [`interactive.flux`](interactive.flux) | Event-mode rules: a `click` mutates state, advances a docstep, and slots refresh. | Runtime kernel (events) |

## Try them

```bash
# Build the CLI once
pnpm --filter @flux-lang/cli build
FLUX="node packages/cli/dist/bin/flux.js"

# Static check + render IR
$FLUX check examples/automaton.flux
$FLUX render --format ir examples/automaton.flux --docstep 3

# Watch the automaton spread across docsteps (lit cells grow)
for d in 0 1 2 3; do $FLUX render --format ir examples/automaton.flux --docstep $d > /dev/null; done

# Open the interactive counter in the viewer, then POST a click:
$FLUX view examples/interactive.flux
#   curl -X POST localhost:<port>/api/event -H 'content-type: application/json' -d '{"type":"click"}'
```

## Notes

- **Determinism** — for the same `(seed, time, docstep)` the Render IR is byte-for-byte identical.
- **Rule calculus** — rules support `let` bindings, multi-branch `when … else when … else`,
  `advanceDocstep()`, neighbour aggregates (`neighbors.all().dynamic`), and a deterministic math
  stdlib (`min`, `max`, `clamp`, `abs`, `floor`, `ceil`, `round`, `mod`, `pow`, `sqrt`, `lerp`).
- **Events** — `mode = event` rules run on delivered events under the document's
  `runtime.eventsApply` policy (`immediate`, `deferred`, or the default cell-immediate/params-deferred).
