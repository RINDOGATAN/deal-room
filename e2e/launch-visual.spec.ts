/**
 * Visual capture of the Launch journey at mobile (375px) and desktop (1440px).
 * Takes full-page screenshots of each screen for visual inspection of
 * responsiveness, spacing, and touch-target sizes. Not assertive — manual
 * review of the screenshots in test-results/launch-screens/.
 */
import { test } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Launch journey — visual capture", () => {
  test("capture every screen", async ({ page }, testInfo) => {
    const suffix = testInfo.project.name;
    const email = `e2e-visual-${suffix}-${Date.now()}@dealroom.test`;
    await loginAs(page, email);

    await page.goto("/launch");
    await page.screenshot({
      path: `test-results/launch-screens/01-landing-${suffix}.png`,
      fullPage: true,
    });

    await page.goto("/launch/new");
    await page.screenshot({
      path: `test-results/launch-screens/02-new-step1-company-${suffix}.png`,
      fullPage: true,
    });

    await page.getByLabel("Company name *").fill(`Visual Acme ${Date.now()}`);
    await page.getByLabel(/Principal business address/i).fill("548 Market St, SF, CA 94104");
    await page.getByRole("button", { name: /Next: founders/i }).click();
    await page.screenshot({
      path: `test-results/launch-screens/03-new-step2-founders-${suffix}.png`,
      fullPage: true,
    });

    await page.getByLabel("Full name").fill("Alice Founder");
    await page.getByLabel("Email").fill("alice@example.com");
    await page.getByLabel("Equity %").fill("100");
    await page.getByRole("button", { name: /Review/i }).click();
    await page.screenshot({
      path: `test-results/launch-screens/04-new-step3-review-${suffix}.png`,
      fullPage: true,
    });

    await page.getByRole("button", { name: /Create journey/i }).click();
    await page.waitForURL(/\/launch\/[a-z0-9]+$/);
    await page.screenshot({
      path: `test-results/launch-screens/05-hub-empty-${suffix}.png`,
      fullPage: true,
    });

    await page.getByRole("link", { name: /^Start/i }).click();
    await page.screenshot({
      path: `test-results/launch-screens/06-foundation-q1-${suffix}.png`,
      fullPage: true,
    });

    await page.getByRole("button", { name: /No.*vest over 4 years/i }).click();
    await page.screenshot({
      path: `test-results/launch-screens/07-foundation-q2-${suffix}.png`,
      fullPage: true,
    });

    await page.getByRole("button", { name: /assign everything relevant/i }).click();
    await page.screenshot({
      path: `test-results/launch-screens/08-foundation-review-${suffix}.png`,
      fullPage: true,
    });

    await page.getByRole("button", { name: /Generate 3 documents/i }).click();
    await page.waitForURL(/\/launch\/[a-z0-9]+$/, { timeout: 20_000 });
    // Wait for the fresh journey.get query to hydrate the "Ready" badge
    await page.getByRole("button", { name: /Request lawyer review/i }).waitFor({
      state: "visible",
      timeout: 15_000,
    });
    await page.screenshot({
      path: `test-results/launch-screens/09-hub-after-generate-${suffix}.png`,
      fullPage: true,
    });

    // Open the request-review dialog, wait for it to fully render
    await page.getByRole("button", { name: /Request lawyer review/i }).click();
    await page.getByRole("dialog").waitFor({ state: "visible" });
    await page.waitForTimeout(500); // let transition settle
    await page.screenshot({
      path: `test-results/launch-screens/10-review-dialog-${suffix}.png`,
      fullPage: false,
    });
  });
});
