import { defineConfig, loadEnv } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const VERSION_JSON_PATH = resolve(__dirname, "../../version.json");
const DEFAULT_VERSION_INFO = { version: "0.0.0", channel: "stable" };

function readFluxVersionInfo() {
  if (!existsSync(VERSION_JSON_PATH)) return DEFAULT_VERSION_INFO;
  try {
    const parsed = JSON.parse(readFileSync(VERSION_JSON_PATH, "utf8")) as { version?: string; channel?: string };
    const version = String(parsed.version ?? DEFAULT_VERSION_INFO.version).replace(/^v+/i, "") || DEFAULT_VERSION_INFO.version;
    const channel = parsed.channel === "canary" ? "canary" : "stable";
    return { version, channel };
  } catch {
    return DEFAULT_VERSION_INFO;
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    base: env.VITE_BASE ?? "/edit/",
    define: {
      __FLUX_VERSION_INFO__: JSON.stringify(readFluxVersionInfo()),
    },
    server: {
      port: 5173
    },
    build: {
      assetsDir: "",
      sourcemap: true
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/setupTests.ts",
      globals: true,
      include: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
      exclude: [...configDefaults.exclude, "tests/e2e/**", "**/*.e2e.*"]
    }
  };
});
