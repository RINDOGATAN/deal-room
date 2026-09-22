import { defineConfig } from "@playwright/test";

/**
 * Pilot-user smoke walk (`e2e/smoke/pilot-walk.spec.ts`).
 *
 * Runs against a LOCAL production build (`next build`, then `next start`)
 * on a seeded local database, never the hosted service. Start the server
 * yourself or let `webServer` start it; either way the build must have been
 * made with `NEXT_PUBLIC_LOCAL_AUTH_ENABLED=true` (the self-host sign-in).
 *
 *   npx next build && npx playwright test -c playwright.smoke.config.ts
 */
const PORT = Number(process.env.SMOKE_PORT || 3014);
const baseURL = process.env.SMOKE_BASE_URL || `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e/smoke",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 180_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  webServer: process.env.SMOKE_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },

  projects: [
    { name: "desktop-1280", use: { viewport: { width: 1280, height: 800 } } },
    {
      name: "mobile-390",
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
});
