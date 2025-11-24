import { describe, it, expect } from "vitest";
import { parseDocument } from "../src/parser";
import type { FluxDocument } from "../src/ast";

describe("Flux parser v0.1", () => {
    it("parses a minimal document", () => {
        const src = `
      document {
        meta {
          title   = "Minimal Flux";
          author  = "Test";
          version = "0.1.0";
        }

        state {
          param docstep : int [0, inf] @ 0;
        }
      }
    `;

        const doc: FluxDocument = parseDocument(src);

        expect(doc.meta.title).toBe("Minimal Flux");
        expect(doc.meta.version).toBe("0.1.0");
        expect(doc.state.params.length).toBe(1);
        expect(doc.state.params[0].name).toBe("docstep");
        expect(doc.grids.length).toBe(0);
        expect(doc.rules.length).toBe(0);
    });

    it("parses a document with one param and one grid", () => {
        const src = `
      document {
        meta {
          title   = "Grid Doc";
          version = "0.1.0";
        }

        state {
          param tempo : float [40, 72] @ 60;
        }

        pageConfig {
          size {
            width  = 210;
            height = 297;
            units  = "mm";
          }
        }

        grid main {
          topology = grid;
          page     = 1;
          size {
            rows = 2;
            cols = 3;
          }

          cell c11 {
            tags    = [ noise, perc ];
            content = "irregular scratches, low";
            dynamic = 0.3;
          }

          cell c12 {
            tags    = [ tone, strings ];
            content = "sustained harmonic, 7-limit";
          }
        }
      }
    `;

        const doc: FluxDocument = parseDocument(src);

        expect(doc.state.params.length).toBe(1);
        expect(doc.state.params[0].name).toBe("tempo");

        expect(doc.pageConfig?.size.width).toBe(210);
        expect(doc.pageConfig?.size.units).toBe("mm");

        expect(doc.grids.length).toBe(1);
        const grid = doc.grids[0];
        expect(grid.name).toBe("main");
        expect(grid.topology).toBe("grid");
        expect(grid.size?.rows).toBe(2);
        expect(grid.cells.length).toBe(2);
        expect(grid.cells[0].id).toBe("c11");
    });

    it("parses a document with docstep and event rules", () => {
        const src = `
      document {
        meta {
          title   = "Rules Doc";
          version = "0.1.0";
        }

        state {
          param tempo   : float [40, 72] @ 60;
          param density : float [0.0, 1.0] @ 0.25;
          param docstep : int [0, inf] @ 0;
        }

        grid main {
          topology = grid;
          size { rows = 1; cols = 2; }

          cell c1 {
            tags    = [ noise ];
            content = "start";
          }

          cell c2 {
            tags    = [ tone ];
            content = "sustain";
          }
        }

        rule growNoise(mode = docstep, grid = main) {
          when cell.content == "" && neighbors.withTag("noise").count >= 2
          then {
            cell.content = "noise";
            cell.tags    = cell.tags + { noise };
          }
        }

        rule echoInput(mode = event, grid = main, on = "input") {
          when event.type == "input"
          then {
            let target = grid.main.nearestTo(event.location);
            target.content = event.payload.text;
          }
        }

        runtime {
          eventsApply = "deferred";
          docstepAdvance = [ timer(8s) ];
        }
      }
    `;

        const doc: FluxDocument = parseDocument(src);

        expect(doc.rules.length).toBe(2);

        const growNoise: any = doc.rules[0];
        expect(growNoise.name).toBe("growNoise");
        expect(growNoise.mode).toBe("docstep");
        expect(growNoise.scope?.grid).toBe("main");

        const echoInput: any = doc.rules[1];
        expect(echoInput.name).toBe("echoInput");
        expect(echoInput.mode).toBe("event");
        expect(echoInput.onEventType).toBe("input");

        expect(doc.runtime?.eventsApply).toBe("deferred");
        expect(doc.runtime?.docstepAdvance?.length).toBe(1);
        expect(doc.runtime?.docstepAdvance?.[0].kind).toBe("timer");
    });

    // ──────────────────────────────────────────────────────────────
    // NEW: Expression / neighbors tests
    // ──────────────────────────────────────────────────────────────

    it("respects operator precedence and grouping", () => {
        const src = `
      document {
        rule r {
          when { 1 + 2 * 3 > 10 && !false || false } then {
            advanceDocstep()
          }
        }
      }
    `;

        const doc = parseDocument(src) as FluxDocument;
        const rule: any = doc.rules[0];
        const cond: any = rule.condition;

        // Top level: (a && b) || c
        expect(cond.kind).toBe("BinaryExpression");
        expect(cond.op).toBe("or");

        const left: any = cond.left;
        const right: any = cond.right;

        expect(left.kind).toBe("BinaryExpression");
        expect(left.op).toBe("and");
        expect(right.kind).toBe("Literal");
        expect(right.value).toBe(false);

        const cmp: any = left.left;
        expect(cmp.kind).toBe("BinaryExpression");
        expect(cmp.op).toBe(">");

        const sum: any = cmp.left;
        expect(sum.kind).toBe("BinaryExpression");
        expect(sum.op).toBe("+");

        const product: any = sum.right;
        expect(product.kind).toBe("BinaryExpression");
        expect(product.op).toBe("*");
    });

    it("parses neighbors member/call chains", () => {
        const src = `
      document {
        rule r {
          when neighbors.all().dynamic > 0.5 then {
            advanceDocstep()
          }
        }
      }
    `;

        const doc = parseDocument(src) as FluxDocument;
        const rule: any = doc.rules[0];
        const cond: any = rule.condition;

        expect(cond.kind).toBe("BinaryExpression");
        expect(cond.op).toBe(">");

        const left: any = cond.left;
        expect(left.kind).toBe("MemberExpression");
        expect(left.property).toBe("dynamic");

        const call: any = left.object;
        expect(call.kind).toBe("NeighborsCallExpression");
        expect(call.namespace).toBe("neighbors");
        expect(call.method).toBe("all");
        expect(call.args).toHaveLength(0);
    });

    // ──────────────────────────────────────────────────────────────
    // NEW: Rule headers + else-when chains
    // ──────────────────────────────────────────────────────────────

    describe("rule headers and branches", () => {
        it("parses timer-mode rule headers", () => {
            const src = `
      document {
        state {
          param docstep : int [0, inf] @ 0;
        }

        grid main {
          topology = grid;
          size { rows = 1; cols = 1; }

          cell c1 {
            tags    = [ noise ];
            content = "start";
          }
        }

        rule tick(mode = timer, grid = main) {
          when cell.dynamic > 0.5
          then {
            cell.dynamic = cell.dynamic - 0.1;
          }
        }
      }
    `;

            const doc = parseDocument(src);

            expect(doc.rules.length).toBe(1);
            const tick = doc.rules[0];

            expect(tick.name).toBe("tick");
            expect(tick.mode).toBe("timer");
            expect(tick.scope?.grid).toBe("main");
        });
        it("parses docstep, event, and scoped rules", () => {
            const src = `
        document {
          rule docImplicit {
            when true then { advanceDocstep() }
          }

          rule docScoped(mode=docstep, grid=main) {
            when true then { advanceDocstep() }
          }

          rule clickRule(mode=event, on="click") {
            when true then { advanceDocstep() }
          }
        }
      `;

            const doc = parseDocument(src) as FluxDocument;
            expect(doc.rules.length).toBe(3);

            const implicit: any = doc.rules[0];
            expect(implicit.name).toBe("docImplicit");
            expect(implicit.mode).toBe("docstep");
            expect(implicit.scope).toBeUndefined();
            expect(implicit.onEventType).toBeUndefined();

            const scoped: any = doc.rules[1];
            expect(scoped.name).toBe("docScoped");
            expect(scoped.mode).toBe("docstep");
            expect(scoped.scope).toEqual({ grid: "main" });

            const click: any = doc.rules[2];
            expect(click.name).toBe("clickRule");
            expect(click.mode).toBe("event");
            expect(click.onEventType).toBe("click");
        });

        it("rejects event rules without on=\"...\"", () => {
            const src = `
        document {
          rule bad(mode=event) {
            when true then { advanceDocstep() }
          }
        }
      `;

            expect(() => parseDocument(src)).toThrow(/Event rules must specify/);
        });

        it("parses else-when chains into branches", () => {
            const src = `
        document {
          rule classify {
            when a > 0 then { x = 1; }
            else when a == 0 then { x = 0; }
            else when a < 0 then { x = -1; }
            else { x = 999; }
          }
        }
      `;

            const doc = parseDocument(src) as FluxDocument;
            const rule: any = doc.rules[0];

            expect(rule.name).toBe("classify");
            expect(rule.branches).toHaveLength(3);
            expect(rule.elseBranch).toBeDefined();

            // convenience mirrors of first branch
            expect(rule.condition).toBe(rule.branches[0].condition);
            expect(rule.thenBranch).toBe(rule.branches[0].thenBranch);
        });
    });

    // ──────────────────────────────────────────────────────────────
    // NEW: Runtime: eventsApply + docstepAdvance timers
    // ──────────────────────────────────────────────────────────────

    describe("runtime config parsing", () => {
        it("parses docstepAdvance timers with musical units (beats)", () => {
            const src = `
      document {
        state {
          param docstep : int [0, inf] @ 0;
        }

        runtime {
          docstepAdvance = [ timer(4 beats) ];
        }
      }
    `;

            const doc = parseDocument(src);

            const advance = doc.runtime?.docstepAdvance;
            expect(advance).toBeDefined();
            expect(advance?.length).toBe(1);

            const timer = advance?.[0];
            expect(timer).toEqual({
                kind: "timer",
                amount: 4,
                unit: "beats",
            });
        });
        it("parses eventsApply only from string values", () => {
            const okSrc = `
        document {
          runtime {
            eventsApply = "deferred";
          }
        }
      `;
            const okDoc = parseDocument(okSrc) as FluxDocument;
            expect(okDoc.runtime?.eventsApply).toBe("deferred");

            const badSrc = `
        document {
          runtime {
            eventsApply = deferred;
          }
        }
      `;
            expect(() => parseDocument(badSrc)).toThrow(
                /Expected string value for eventsApply/,
            );
        });

        it("parses docstepAdvance timers with amount and unit", () => {
            const src = `
        document {
          runtime {
            docstepAdvance = [
              timer(1 s),
              timer(250 ms),
              timer(4 beats)
            ];
          }
        }
      `;

            const doc = parseDocument(src) as FluxDocument;
            const specs: any[] = doc.runtime?.docstepAdvance ?? [];

            expect(specs).toHaveLength(3);

            expect(specs[0]).toMatchObject({ kind: "timer", amount: 1, unit: "s" });
            expect(specs[1]).toMatchObject({ kind: "timer", amount: 250, unit: "ms" });
            expect(specs[2]).toMatchObject({
                kind: "timer",
                amount: 4,
                unit: "beats",
            });
        });
    });
    describe("canonical IR snapshots", () => {
        it("produces canonical IR for docstep + neighbors + runtime", () => {
            const src = `
        document {
          meta {
            title   = "Canonical Neighbors + Runtime";
            version = "0.1.0";
          }

          state {
            param docstep : int [0, inf]   @ 0;
            param density : float [0.0, 1.0] @ 0.5;
          }

          grid main {
            topology = grid;
            size { rows = 1; cols = 2; }

            cell c1 {
              tags    = [ noise ];
              content = "";
              dynamic = 0.25;
            }

            cell c2 {
              tags    = [ noise, tone ];
              content = "";
              dynamic = 0.75;
            }
          }

          rule growNoise(mode = docstep, grid = main) {
            when { cell.content == "" && neighbors.all().dynamic > 0.5 }
            then {
              cell.content = "noise";
              cell.tags    = cell.tags + { noise };
            }
          }

          runtime {
            eventsApply    = "deferred";
            docstepAdvance = [ timer(8 s) ];
          }
        }
      `;

            const doc = parseDocument(src);
            const ir = JSON.parse(
                JSON.stringify({
                    rules: doc.rules,
                    runtime: doc.runtime,
                }),
            );

            expect(ir).toEqual({
                rules: [
                    {
                        name: "growNoise",
                        mode: "docstep",
                        scope: { grid: "main" },
                        // normalized “branches” array for else-when chains (single branch here)
                        branches: [
                            {
                                condition: {
                                    kind: "BinaryExpression",
                                    op: "and",
                                    left: {
                                        kind: "BinaryExpression",
                                        op: "==",
                                        left: {
                                            kind: "MemberExpression",
                                            object: {
                                                kind: "Identifier",
                                                name: "cell",
                                            },
                                            property: "content",
                                        },
                                        right: {
                                            kind: "Literal",
                                            value: "",
                                        },
                                    },
                                    right: {
                                        kind: "BinaryExpression",
                                        op: ">",
                                        left: {
                                            kind: "MemberExpression",
                                            object: {
                                                kind: "NeighborsCallExpression",
                                                namespace: "neighbors",
                                                method: "all",
                                                args: [],
                                            },
                                            property: "dynamic",
                                        },
                                        right: {
                                            kind: "Literal",
                                            value: 0.5,
                                        },
                                    },
                                },
                                thenBranch: [
                                    {
                                        kind: "AssignmentStatement",
                                        target: {
                                            kind: "MemberExpression",
                                            object: {
                                                kind: "Identifier",
                                                name: "cell",
                                            },
                                            property: "content",
                                        },
                                        value: {
                                            kind: "Literal",
                                            value: "noise",
                                        },
                                    },
                                    {
                                        kind: "AssignmentStatement",
                                        target: {
                                            kind: "MemberExpression",
                                            object: {
                                                kind: "Identifier",
                                                name: "cell",
                                            },
                                            property: "tags",
                                        },
                                        value: {
                                            kind: "BinaryExpression",
                                            op: "+",
                                            left: {
                                                kind: "MemberExpression",
                                                object: {
                                                    kind: "Identifier",
                                                    name: "cell",
                                                },
                                                property: "tags",
                                            },
                                            right: {
                                                kind: "Identifier",
                                                name: "noise",
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                        // legacy top-level condition/thenBranch also present in IR
                        condition: {
                            kind: "BinaryExpression",
                            op: "and",
                            left: {
                                kind: "BinaryExpression",
                                op: "==",
                                left: {
                                    kind: "MemberExpression",
                                    object: {
                                        kind: "Identifier",
                                        name: "cell",
                                    },
                                    property: "content",
                                },
                                right: {
                                    kind: "Literal",
                                    value: "",
                                },
                            },
                            right: {
                                kind: "BinaryExpression",
                                op: ">",
                                left: {
                                    kind: "MemberExpression",
                                    object: {
                                        kind: "NeighborsCallExpression",
                                        namespace: "neighbors",
                                        method: "all",
                                        args: [],
                                    },
                                    property: "dynamic",
                                },
                                right: {
                                    kind: "Literal",
                                    value: 0.5,
                                },
                            },
                        },
                        thenBranch: [
                            {
                                kind: "AssignmentStatement",
                                target: {
                                    kind: "MemberExpression",
                                    object: {
                                        kind: "Identifier",
                                        name: "cell",
                                    },
                                    property: "content",
                                },
                                value: {
                                    kind: "Literal",
                                    value: "noise",
                                },
                            },
                            {
                                kind: "AssignmentStatement",
                                target: {
                                    kind: "MemberExpression",
                                    object: {
                                        kind: "Identifier",
                                        name: "cell",
                                    },
                                    property: "tags",
                                },
                                value: {
                                    kind: "BinaryExpression",
                                    op: "+",
                                    left: {
                                        kind: "MemberExpression",
                                        object: {
                                            kind: "Identifier",
                                            name: "cell",
                                        },
                                        property: "tags",
                                    },
                                    right: {
                                        kind: "Identifier",
                                        name: "noise",
                                    },
                                },
                            },
                        ],
                    },
                ],
                runtime: {
                    eventsApply: "deferred",
                    docstepAdvance: [
                        {
                            kind: "timer",
                            amount: 8,
                            unit: "s",
                        },
                    ],
                },
            });
        });

        it("produces canonical IR for an event rule with else branch", () => {
            const src = `
        document {
          meta {
            title   = "Canonical Event Rule";
            version = "0.1.0";
          }

          state {
            param docstep : int [0, inf] @ 0;
          }

          grid main {
            topology = grid;
            size { rows = 1; cols = 1; }

            cell c1 {
              tags    = [ tone ];
              content = "idle";
            }
          }

          rule handleClick(mode = event, grid = main, on = "click") {
            when event.type == "click"
            then {
              let target = grid.main.nearestTo(event.location);
              target.content = "clicked";
            }
            else {
              let target = grid.main.nearestTo(event.location);
              target.content = "fallback";
            }
          }
        }
      `;

            const doc = parseDocument(src);
            const ir = JSON.parse(JSON.stringify(doc.rules[0]));

            expect(ir).toEqual({
                name: "handleClick",
                mode: "event",
                scope: { grid: "main" },
                onEventType: "click",
                // normalized branches (first branch is the main when/then)
                branches: [
                    {
                        condition: {
                            kind: "BinaryExpression",
                            op: "==",
                            left: {
                                kind: "MemberExpression",
                                object: {
                                    kind: "Identifier",
                                    name: "event",
                                },
                                property: "type",
                            },
                            right: {
                                kind: "Literal",
                                value: "click",
                            },
                        },
                        thenBranch: [
                            {
                                kind: "LetStatement",
                                name: "target",
                                value: {
                                    kind: "CallExpression",
                                    callee: {
                                        kind: "MemberExpression",
                                        object: {
                                            kind: "MemberExpression",
                                            object: {
                                                kind: "Identifier",
                                                name: "grid",
                                            },
                                            property: "main",
                                        },
                                        property: "nearestTo",
                                    },
                                    args: [
                                        {
                                            kind: "MemberExpression",
                                            object: {
                                                kind: "Identifier",
                                                name: "event",
                                            },
                                            property: "location",
                                        },
                                    ],
                                },
                            },
                            {
                                kind: "AssignmentStatement",
                                target: {
                                    kind: "MemberExpression",
                                    object: {
                                        kind: "Identifier",
                                        name: "target",
                                    },
                                    property: "content",
                                },
                                value: {
                                    kind: "Literal",
                                    value: "clicked",
                                },
                            },
                        ],
                    },
                ],
                // legacy top-level condition/branches
                condition: {
                    kind: "BinaryExpression",
                    op: "==",
                    left: {
                        kind: "MemberExpression",
                        object: {
                            kind: "Identifier",
                            name: "event",
                        },
                        property: "type",
                    },
                    right: {
                        kind: "Literal",
                        value: "click",
                    },
                },
                thenBranch: [
                    {
                        kind: "LetStatement",
                        name: "target",
                        value: {
                            kind: "CallExpression",
                            callee: {
                                kind: "MemberExpression",
                                object: {
                                    kind: "MemberExpression",
                                    object: {
                                        kind: "Identifier",
                                        name: "grid",
                                    },
                                    property: "main",
                                },
                                property: "nearestTo",
                            },
                            args: [
                                {
                                    kind: "MemberExpression",
                                    object: {
                                        kind: "Identifier",
                                        name: "event",
                                    },
                                    property: "location",
                                },
                            ],
                        },
                    },
                    {
                        kind: "AssignmentStatement",
                        target: {
                            kind: "MemberExpression",
                            object: {
                                kind: "Identifier",
                                name: "target",
                            },
                            property: "content",
                        },
                        value: {
                            kind: "Literal",
                            value: "clicked",
                        },
                    },
                ],
                elseBranch: [
                    {
                        kind: "LetStatement",
                        name: "target",
                        value: {
                            kind: "CallExpression",
                            callee: {
                                kind: "MemberExpression",
                                object: {
                                    kind: "MemberExpression",
                                    object: {
                                        kind: "Identifier",
                                        name: "grid",
                                    },
                                    property: "main",
                                },
                                property: "nearestTo",
                            },
                            args: [
                                {
                                    kind: "MemberExpression",
                                    object: {
                                        kind: "Identifier",
                                        name: "event",
                                    },
                                    property: "location",
                                },
                            ],
                        },
                    },
                    {
                        kind: "AssignmentStatement",
                        target: {
                            kind: "MemberExpression",
                            object: {
                                kind: "Identifier",
                                name: "target",
                            },
                            property: "content",
                        },
                        value: {
                            kind: "Literal",
                            value: "fallback",
                        },
                    },
                ],
            });
        });
    });
});
