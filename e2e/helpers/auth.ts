import { type Page, type Browser } from "@playwright/test";

const E2E_SECRET = process.env.E2E_CREDENTIALS_SECRET || "e2e-test-secret";

/**
 * Signs in via the E2E credentials provider as the given email.
 * Uses page.request to POST credentials, then copies cookies to the browser.
 *
 * REQUIRES: E2E_CREDENTIALS_SECRET must be set on the target server
 * for the CredentialsProvider to be registered.
 */
export async function loginAs(page: Page, email: string) {
  // Get CSRF token
  const csrfRes = await page.request.get("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();

  // Sign in via the credentials callback API
  const loginRes = await page.request.post("/api/auth/callback/e2e-credentials", {
    form: {
      csrfToken,
      email,
      secret: E2E_SECRET,
      json: "true",
    },
  });

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

/** Backward-compatible: logs in as the default E2E test user. */
export async function trialLogin(page: Page) {
  await loginAs(page, "e2e-test@dealroom.test");
}

/**
 * Creates a second browser context logged in as a different user.
 * Useful for two-party negotiation tests.
 * Also sets the user role to BUSINESS_OWNER via API to prevent
 * the OnboardingModal from blocking the UI.
 */
export async function createSecondUser(browser: Browser, baseURL: string, email: string) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await loginAs(page, email);

  // Set role via tRPC API to prevent OnboardingModal from appearing.
  // Uses httpBatchLink format (batch=1 + indexed body).
  await page.evaluate(async () => {
    const res = await fetch("/api/trpc/lawyer.setRole?batch=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "0": { json: { role: "BUSINESS_OWNER" } } }),
      credentials: "include",
    });
    if (!res.ok) throw new Error(`setRole failed: ${res.status}`);
  });
  // Re-login so the JWT session picks up the new role from DB
  await loginAs(page, email);

  return { context, page };
}
