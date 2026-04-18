import { defineConfig } from "@playwright/test";

/**
 * Temporary config for recording the SaaS demo video.
 * Uses 1920x1080 viewport with video recording enabled.
 * Delete after capturing.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  timeout: 900_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    video: { mode: "on", size: { width: 1920, height: 1080 } },
    viewport: { width: 1920, height: 1080 },
    trace: "off",
    screenshot: "off",
  },
  projects: [
    {
      name: "desktop",
      use: { viewport: { width: 1920, height: 1080 } },
    },
  ],
});
