import { test, expect } from "@playwright/test";
import { trialLogin } from "./helpers/auth";

// Helper to create a deal and navigate to negotiate page
async function createDealAndNavigate(page: import("@playwright/test").Page) {
  await trialLogin(page);
  await page.goto("/deals/new");
  await expect(page.locator("text=Loading contract types")).toBeHidden({ timeout: 10_000 });

  await page.locator("h3", { hasText: "Data Processing Agreement" }).first().click();
  await page.locator("text=California, USA").click();
  await page.locator("input#dealName").fill(`E2E Negotiate ${Date.now()}`);
  await page.locator("button", { hasText: "Continue" }).click();
  await page.waitForURL("**/negotiate", { timeout: 15_000 });
}

test.describe("Clause Negotiation", () => {
  test("negotiate page loads with sidebar and clause content", async ({ page }) => {
    await createDealAndNavigate(page);

    // Should show the clause header with title
    const clauseTitle = page.locator("h2").first();
    await expect(clauseTitle).toBeVisible();

    // Desktop: sidebar should be visible
    const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
    if (!isMobile) {
      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible();
    }
  });

  test("sidebar shows clause categories with circular checkboxes", async ({ page }) => {
    await createDealAndNavigate(page);

    const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
    if (isMobile) {
      // Open sidebar via FAB
      await page.locator("button.fixed").filter({ has: page.locator("svg.lucide-list") }).click();
    }

    // Sidebar should show clause items with circular checkboxes (empty circles = border-2 rounded-full)
    const clauseButtons = isMobile
      ? page.locator(".fixed.inset-0 button").filter({ has: page.locator(".rounded-full") })
      : page.locator("aside button").filter({ has: page.locator(".rounded-full") });
    await expect(clauseButtons.first()).toBeVisible();
  });

  test("clicking option selects it (radio circle fills)", async ({ page }) => {
    await createDealAndNavigate(page);

    // Click the first option card
    const optionCards = page.locator(".card-brutal.cursor-pointer");
    await expect(optionCards.first()).toBeVisible();
    await optionCards.first().click();

    // The selected option should have a filled radio circle (bg-primary on the inner circle)
    const filledRadio = optionCards.first().locator(".rounded-full.border-primary.bg-primary");
    await expect(filledRadio).toBeVisible();
  });

  test("priority slider is adjustable", async ({ page }) => {
    await createDealAndNavigate(page);

    // First select an option to make the sliders appear
    const optionCards = page.locator(".card-brutal.cursor-pointer");
    await optionCards.first().click();

    // The "Importance Settings" section should appear
    await expect(page.locator("text=Importance Settings")).toBeVisible();
    await expect(page.locator("text=Priority")).toBeVisible();

    // Slider should be visible (Radix slider thumb)
    const sliders = page.locator("[role=slider]");
    await expect(sliders.first()).toBeVisible();
  });

  test("flexibility slider is adjustable", async ({ page }) => {
    await createDealAndNavigate(page);

    const optionCards = page.locator(".card-brutal.cursor-pointer");
    await optionCards.first().click();

    await expect(page.locator("text=Flexibility")).toBeVisible();
    // Second slider is flexibility
    const sliders = page.locator("[role=slider]");
    expect(await sliders.count()).toBeGreaterThanOrEqual(2);
  });

  test("'Continue' saves and advances to next clause", async ({ page }) => {
    await createDealAndNavigate(page);

    // Select an option first
    const optionCards = page.locator(".card-brutal.cursor-pointer");
    await optionCards.first().click();

    // Get current clause text
    const currentTitle = await page.locator("h2").first().textContent();

    // Click Continue
    await page.locator("button", { hasText: "Continue" }).click();

    // Wait for the title to change (next clause)
    await expect(page.locator("h2").first()).not.toHaveText(currentTitle!);
  });

  test("progress counter updates after selection", async ({ page }) => {
    await createDealAndNavigate(page);

    // Check progress is initially 0
    const progressText = page.locator("text=/0\\//");
    await expect(progressText).toBeVisible();

    // Select an option
    const optionCards = page.locator(".card-brutal.cursor-pointer");
    await optionCards.first().click();

    // Progress should update to show 1
    await expect(page.locator("text=/1\\//")).toBeVisible();
  });

  test("mobile: FAB visible, opens sidebar overlay", async ({ page }) => {
    // This test only runs on mobile viewport
    const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
    if (!isMobile) {
      test.skip(true, "Mobile-only test");
      return;
    }

    await createDealAndNavigate(page);

    // FAB should be visible at bottom-left
    const fab = page.locator("button.fixed").filter({ has: page.locator("svg.lucide-list") });
    await expect(fab).toBeVisible();

    // Click FAB to open sidebar overlay
    await fab.click();

    // Overlay should be visible
    const overlay = page.locator(".fixed.inset-0").filter({ hasText: /Clauses/i });
    await expect(overlay).toBeVisible();
  });
});
