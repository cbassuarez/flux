import { afterEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import http from "node:http";
import { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { FLUX_TAGLINE } from "@flux-lang/brand";
import { startViewerServer, type ViewerServer, VIEWER_VERSION } from "../src/index.js";

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

describe("/api/health", () => {
  it("exposes viewer and editor headers", async () => {
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
    req.url = "/api/health";
    req.method = "GET";
    req.headers = {};

    const res = new MockResponse() as unknown as http.ServerResponse;

    await new Promise<void>((resolve, reject) => {
      capturedHandler?.(req, res);
      res.on("finish", () => resolve());
      res.on("error", reject);
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["x-flux-viewer-version"]).toBe(VIEWER_VERSION);
    expect(res.headers["x-flux-editor-build"]).toBeTypeOf("string");
    expect(res.body).toContain("\"viewerVersion\"");
  }, 10000);

  it("serves normalized flux version info", async () => {
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
    req.url = "/api/version";
    req.method = "GET";
    req.headers = {};

    const res = new MockResponse() as unknown as http.ServerResponse;

    await new Promise<void>((resolve, reject) => {
      capturedHandler?.(req, res);
      res.on("finish", () => resolve());
      res.on("error", reject);
    });

    expect(res.statusCode).toBe(200);
    const payload = JSON.parse(res.body) as { version?: string; tagline?: string };
    expect(payload.version).toBeTruthy();
    expect(payload.tagline).toBe(FLUX_TAGLINE);
  }, 10000);
});
