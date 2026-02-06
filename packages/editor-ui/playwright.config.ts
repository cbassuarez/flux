import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:4173/edit/",
    headless: true,
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173 --clearScreen=false",
    port: 4173,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
