import { test, expect } from "@playwright/test";
import { trialLogin } from "./helpers/auth";

test.describe("Review & Sign", () => {
  test.beforeEach(async ({ page }) => {
    await trialLogin(page);
  });

  test("review page loads or shows appropriate state", async ({ page }) => {
    // Navigate to deals list and click the first deal if available
    const dealLinks = page.locator("a[href^='/deals/']").filter({ hasNot: page.locator("svg.lucide-plus") });
    const count = await dealLinks.count();
    if (count === 0) {
      test.skip(true, "No existing deals to test review page");
      return;
    }

    // Click first deal
    await dealLinks.first().click();
    await page.waitForURL("**/deals/**");

    // Try navigating to review
    const currentUrl = page.url();
    const dealId = currentUrl.match(/\/deals\/([^/]+)/)?.[1];
    if (!dealId) {
      test.skip(true, "Could not extract deal ID");
      return;
    }

    await page.goto(`/deals/${dealId}/review`);

    // Should see either the review page content or a loading/error state
    // The page will show "Review Compromises" or "Failed to load review data" or loading skeleton
    const pageLoaded = page.locator("h1, .card-brutal").first();
    await expect(pageLoaded).toBeVisible({ timeout: 10_000 });
  });

  test("sign page renders signature input or appropriate state", async ({ page }) => {
    const dealLinks = page.locator("a[href^='/deals/']").filter({ hasNot: page.locator("svg.lucide-plus") });
    const count = await dealLinks.count();
    if (count === 0) {
      test.skip(true, "No existing deals to test sign page");
      return;
    }

    await dealLinks.first().click();
    await page.waitForURL("**/deals/**");

    const currentUrl = page.url();
    const dealId = currentUrl.match(/\/deals\/([^/]+)/)?.[1];
    if (!dealId) {
      test.skip(true, "Could not extract deal ID");
      return;
    }

    await page.goto(`/deals/${dealId}/sign`);

    // Should see either: signature form, "Not Ready for Signing", or loading state
    const signContent = page.locator("h1, h2, .card-brutal").first();
    await expect(signContent).toBeVisible({ timeout: 10_000 });

    // If the deal is ready for signing, look for the signature input
    const sigInput = page.locator("input[placeholder='e.g., John Smith']");
    const notReady = page.locator("text=Not Ready for Signing");
    const readyForSigs = page.locator("text=Ready for Signatures");

    // One of these states should be visible
    await expect(
      sigInput.or(notReady).or(readyForSigs).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("sign page uses Dancing Script font for signature preview", async ({ page }) => {
    const dealLinks = page.locator("a[href^='/deals/']").filter({ hasNot: page.locator("svg.lucide-plus") });
    const count = await dealLinks.count();
    if (count === 0) {
      test.skip(true, "No existing deals to test sign page fonts");
      return;
    }

    await dealLinks.first().click();
    await page.waitForURL("**/deals/**");

    const currentUrl = page.url();
    const dealId = currentUrl.match(/\/deals\/([^/]+)/)?.[1];
    if (!dealId) {
      test.skip(true, "Could not extract deal ID");
      return;
    }

    await page.goto(`/deals/${dealId}/sign`);

    // Check if we can see a signature preview with the signature font
    const sigPreview = page.locator("[style*='--font-signature']");
    if (await sigPreview.count() > 0) {
      const fontFamily = await sigPreview.first().evaluate(
        (el) => getComputedStyle(el).fontFamily
      );
      expect(fontFamily.toLowerCase()).toContain("script");
    }
  });
});
