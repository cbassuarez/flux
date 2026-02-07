import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:4173",
    headless: true,
  },
  webServer: {
    command: "node tests/e2e/start-cli-edit-server.mjs",
    port: 4173,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
