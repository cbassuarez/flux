import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable, Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startViewerServer, type ViewerServer } from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MockResponse extends Writable {
  statusCode = 200;
  headers: Record<string, string | number> = {};
  chunks: Buffer[] = [];

  override _write(chunk: any, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
    callback();
  }

  writeHead(status: number, headers?: Record<string, string | number>): this {
    this.statusCode = status;
    if (headers) this.headers = { ...this.headers, ...headers };
    return this;
  }

  setHeader(name: string, value: string | number): void {
    this.headers[name.toLowerCase()] = value;
  }

  get body(): string {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}

let server: ViewerServer | null = null;

afterEach(async () => {
  if (server) {
    await server.close();
    server = null;
  }
  vi.restoreAllMocks();
});

describe("/edit route", () => {
  it("serves the editor app with marker", async () => {
    const docPath = path.resolve(__dirname, "../../../examples/viewer-demo.flux");

    let capturedHandler: http.RequestListener | null = null;
    const serverStub = {
      listen: (_port: number, _host: string, cb?: () => void) => {
        cb?.();
        return serverStub;
      },
      address: () => ({ port: 0, address: "127.0.0.1" }),
      close: (cb?: () => void) => {
        cb?.();
        return serverStub;
      },
      on: () => serverStub,
    } as unknown as http.Server;

    vi.spyOn(http, "createServer").mockImplementation((handler: http.RequestListener) => {
      capturedHandler = handler;
      return serverStub;
    });

    server = await startViewerServer({ docPath, port: 0, host: "127.0.0.1" });
    expect(capturedHandler).toBeTruthy();

    const req = new Readable({ read() { this.push(null); } }) as http.IncomingMessage;
    req.url = "/edit";
    req.method = "GET";
    req.headers = {};

    const res = new MockResponse() as unknown as http.ServerResponse;

    await new Promise<void>((resolve, reject) => {
      if (!capturedHandler) reject(new Error("handler missing"));
      capturedHandler?.(req, res);
      res.on("finish", () => resolve());
      res.on("error", reject);
    });

    expect(res.statusCode).toBe(200);
    expect((res as any).body).toContain('name="flux-editor"');
  });
});
