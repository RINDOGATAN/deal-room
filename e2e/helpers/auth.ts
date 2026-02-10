import { type Page, expect } from "@playwright/test";

const E2E_EMAIL = "e2e-test@dealroom.test";
const E2E_SECRET = process.env.E2E_CREDENTIALS_SECRET || "e2e-test-secret";

/**
 * Signs in via the E2E credentials provider.
 * Uses page.request to POST credentials, then copies cookies to the browser.
 *
 * REQUIRES: E2E_CREDENTIALS_SECRET must be set on the target server
 * for the CredentialsProvider to be registered.
 */
export async function trialLogin(page: Page) {
  // Get CSRF token
  const csrfRes = await page.request.get("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();

  // Sign in via the credentials callback API
  const loginRes = await page.request.post("/api/auth/callback/e2e-credentials", {
    form: {
      csrfToken,
      email: E2E_EMAIL,
      secret: E2E_SECRET,
      json: "true",
    },
  });

  // Verify the login succeeded — a 400 means the provider isn't registered
  // (E2E_CREDENTIALS_SECRET not set on the server)
  if (loginRes.status() >= 400) {
    const body = await loginRes.text();
    throw new Error(
      `E2E login failed (${loginRes.status()}): ${body.substring(0, 200)}. ` +
      `Is E2E_CREDENTIALS_SECRET set on the server?`,
    );
  }

  // Copy cookies from APIRequestContext to browser context
  const storageState = await page.request.storageState();
  const hasSession = storageState.cookies.some((c) =>
    c.name.includes("session-token"),
  );
  if (!hasSession) {
    throw new Error(
      "No session token cookie after login. " +
      "Cookies: " + storageState.cookies.map((c) => c.name).join(", "),
    );
  }
  await page.context().addCookies(storageState.cookies);

  // Navigate to deals — session cookie should be set
  await page.goto("/deals");
  await page.waitForURL("**/deals", { timeout: 15_000 });
}
