import { type Page, expect } from "@playwright/test";

/**
 * Signs in via the built-in Trial/Demo auth flow.
 * Navigates to /sign-in, clicks "Try Demo", waits for redirect to /deals.
 */
export async function trialLogin(page: Page) {
  await page.goto("/sign-in");
  // Click the trial/demo button — it contains the "Try Demo" / "Probar Demo" text
  const trialButton = page.locator("button", { hasText: /try demo|probar demo/i });
  await expect(trialButton).toBeVisible();
  await trialButton.click();
  // Wait for the redirect to the deals page
  await page.waitForURL("**/deals", { timeout: 15_000 });
}
