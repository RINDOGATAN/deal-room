import { test, expect } from "@playwright/test";
import { trialLogin } from "./helpers/auth";

test.describe("Deals List", () => {
  test.beforeEach(async ({ page }) => {
    await trialLogin(page);
  });

  test("page loads after trial login", async ({ page }) => {
    await expect(page).toHaveURL(/\/deals/);
    // Should see either deals or the empty state
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible();
  });

  test("header shows trial user email", async ({ page }) => {
    const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
    if (isMobile) {
      // Open mobile menu to see email
      await page.locator("button").filter({ has: page.locator("svg.lucide-menu") }).click();
    }
    await expect(page.locator("text=demo@trial.dealroom.app").first()).toBeVisible();
  });

  test("'New Deal' nav link exists and navigates", async ({ page }) => {
    const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
    if (isMobile) {
      await page.locator("button").filter({ has: page.locator("svg.lucide-menu") }).click();
    }
    const newDealLink = page.locator("a[href='/deals/new']").first();
    await expect(newDealLink).toBeVisible();
    await newDealLink.click();
    await expect(page).toHaveURL(/\/deals\/new/);
  });

  test("shows deals or empty state", async ({ page }) => {
    // Either we see deal cards with status badges, or the empty state message
    const dealsOrEmpty = page
      .locator(".card-brutal")
      .first();
    await expect(dealsOrEmpty).toBeVisible();
  });
});
