import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  timeout: 30_000,

  use: {
    baseURL: process.env.E2E_BASE_URL || "https://dealroom.todo.law",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "desktop",
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { viewport: { width: 375, height: 812 }, isMobile: true },
    },
  ],
});
