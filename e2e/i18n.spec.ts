import { test, expect } from "@playwright/test";
import { trialLogin } from "./helpers/auth";

test.describe("Internationalization", () => {
  test("default locale is EN", async ({ page }) => {
    await trialLogin(page);

    const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
    if (isMobile) {
      await page.locator("button").filter({ has: page.locator("svg.lucide-menu") }).click();
    }

    // Language switcher should show "EN"
    const langButton = page.locator("button", { hasText: "EN" });
    await expect(langButton).toBeVisible();

    // Navigation should be in English
    await expect(page.locator("text=My Deals").first()).toBeVisible();
  });

  test("language toggle switches to ES", async ({ page }) => {
    await trialLogin(page);

    const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
    if (isMobile) {
      await page.locator("button").filter({ has: page.locator("svg.lucide-menu") }).click();
    }

    // Click the language switcher to switch to ES
    const langButton = page.locator("button", { hasText: "EN" });
    await langButton.click();

    // Wait for the page to refresh with Spanish locale
    // "My Deals" should become "Mis Acuerdos"
    await expect(page.locator("text=Mis Acuerdos").first()).toBeVisible({ timeout: 10_000 });

    // Language button should now show "ES"
    if (isMobile) {
      await page.locator("button").filter({ has: page.locator("svg.lucide-menu") }).click();
    }
    await expect(page.locator("button", { hasText: "ES" }).first()).toBeVisible();
  });

  test("switch back to EN works", async ({ page }) => {
    await trialLogin(page);

    const isMobile = (page.viewportSize()?.width ?? 1440) < 768;

    // Switch to ES first
    if (isMobile) {
      await page.locator("button").filter({ has: page.locator("svg.lucide-menu") }).click();
    }
    await page.locator("button", { hasText: "EN" }).click();
    await expect(page.locator("text=Mis Acuerdos").first()).toBeVisible({ timeout: 10_000 });

    // Now switch back to EN
    if (isMobile) {
      await page.locator("button").filter({ has: page.locator("svg.lucide-menu") }).click();
    }
    await page.locator("button", { hasText: "ES" }).first().click();
    await expect(page.locator("text=My Deals").first()).toBeVisible({ timeout: 10_000 });
  });
});
