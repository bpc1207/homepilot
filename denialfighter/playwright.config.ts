import { defineConfig } from "@playwright/test";

// Smoke test runs against an already-running server (see scripts/e2e.sh).
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
  },
});
