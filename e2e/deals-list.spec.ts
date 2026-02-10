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

  test("header shows authenticated user info", async ({ page }) => {
    // Wait for dashboard to fully render
    await expect(page.locator("text=My Deals").first()).toBeVisible({ timeout: 10_000 });

    const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
    if (isMobile) {
      await page.locator("button").filter({ has: page.locator("svg.lucide-menu") }).click();
    }
    // Sign-out button should be visible (indicates authenticated state)
    await expect(
      page.locator("button", { hasText: /sign out|cerrar sesión/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("'New Deal' nav link exists and navigates", async ({ page }) => {
    await expect(page.locator("text=My Deals").first()).toBeVisible({ timeout: 10_000 });

    const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
    if (isMobile) {
      await page.locator("button").filter({ has: page.locator("svg.lucide-menu") }).click();
    }
    const newDealLink = page.locator("a[href='/deals/new']").first();
    await expect(newDealLink).toBeVisible({ timeout: 10_000 });
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
