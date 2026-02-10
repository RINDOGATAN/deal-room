import { type Page, expect } from "@playwright/test";

const E2E_EMAIL = "e2e-test@dealroom.test";
const E2E_SECRET = process.env.E2E_CREDENTIALS_SECRET || "e2e-test-secret";

/**
 * Signs in via the E2E credentials provider.
 * POSTs directly to the NextAuth callback API, then navigates to /deals.
 * Requires E2E_CREDENTIALS_SECRET to be set on the server.
 */
export async function trialLogin(page: Page) {
  // Get CSRF token
  const csrfRes = await page.request.get("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();

  // Sign in via the credentials callback API
  await page.request.post("/api/auth/callback/e2e-credentials", {
    form: {
      csrfToken,
      email: E2E_EMAIL,
      secret: E2E_SECRET,
      json: "true",
    },
  });

  // Navigate to deals — session cookie should be set
  await page.goto("/deals");
  await page.waitForURL("**/deals", { timeout: 15_000 });
}
