# @flux-lang/typesetter

1) **What this package is**
   Typesetting backends for Flux HTML rendering (PDF generation).

2) **When you use it**
   Use it when you need to turn HTML/CSS output into a PDF snapshot.

3) **Install**

```bash
pnpm add @flux-lang/typesetter
```

4) **Basic usage**

```ts
import { createTypesetterBackend } from "@flux-lang/typesetter";

const typesetter = createTypesetterBackend();
const pdf = await typesetter.pdf("<main>Hello</main>", "body { font: 16px sans; }");
```

5) **Reference**
- **Entry point**: `createTypesetterBackend` (returns a backend with `pdf()` and optional `paginate()`)
- **Backends**: Playwright by default; optional PrinceXML or Antenna House if available.

6) **How it relates to IR/runtime**
It consumes HTML/CSS output (typically from `@flux-lang/render-html`) and does not operate on IR directly.

7) **Gotchas & troubleshooting**
- Playwright is required for the default backend and must be installed in your environment.

8) **Versioning / compatibility notes**
TBD / Not yet implemented.

9) **Links**
- Root Flux manual: [`../../README.md`](../../README.md)
- Source: [`src/`](src/)
