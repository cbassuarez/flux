import { describe, it, expect } from "vitest";
import { indexFiles } from "../src/file-indexer.js";

describe("file indexer", () => {
  it("caps indexed files at max and reports truncation", async () => {
    async function* walker(total: number) {
      for (let i = 0; i < total; i += 1) {
        yield `/tmp/file-${i}.flux`;
      }
    }

    const events: { type: string; indexed?: number; truncated?: boolean }[] = [];
    for await (const event of indexFiles({ walker: walker(25000), maxFiles: 20000 })) {
      events.push(event);
    }

    const fileEvents = events.filter((event) => event.type === "file");
    const doneEvent = events.find((event) => event.type === "done") as { indexed: number; truncated: boolean };

    expect(fileEvents.length).toBe(20000);
    expect(doneEvent.indexed).toBe(20000);
    expect(doneEvent.truncated).toBe(true);
  });

  it("yields incrementally without prefetching", async () => {
    let produced = 0;
    async function* walker() {
      while (produced < 5) {
        produced += 1;
        yield `/tmp/file-${produced}.flux`;
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    }

    const iter = indexFiles({ walker: walker(), maxFiles: 10 });
    const first = await iter.next();

    expect(first.value?.type).toBe("file");
    expect(produced).toBe(1);
  });
});
