import { test, expect } from "@playwright/test";
import { trialLogin } from "./helpers/auth";

test.describe("Deal Creation", () => {
  test.beforeEach(async ({ page }) => {
    await trialLogin(page);
    await page.goto("/deals/new");
  });

  test("step 1: contract types are visible", async ({ page }) => {
    await expect(page.locator("h1", { hasText: "Create New Deal" })).toBeVisible();
    // Wait for templates to load (skeleton disappears, real cards appear)
    await expect(page.locator("text=Loading contract types")).toBeHidden({ timeout: 10_000 });
    // Should show at least DPA
    await expect(page.locator("h3", { hasText: "Data Processing Agreement" }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("locked skills show lock icon", async ({ page }) => {
    await expect(page.locator("text=Loading contract types")).toBeHidden({ timeout: 10_000 });
    // Look for lock icons (locked skills have opacity-60 and border-dashed)
    const lockedCards = page.locator("button.opacity-60");
    // If there are locked skills, they should have a lock icon
    const count = await lockedCards.count();
    if (count > 0) {
      await expect(lockedCards.first().locator("svg.lucide-lock")).toBeVisible();
    }
  });

  test("step 2: jurisdiction options appear after type selection", async ({ page }) => {
    await expect(page.locator("text=Loading contract types")).toBeHidden({ timeout: 10_000 });
    // Select DPA (first available unlocked template)
    const dpaCard = page.locator("h3", { hasText: "Data Processing Agreement" }).first();
    await dpaCard.click();

    // Step 2 should now be visible with jurisdiction options
    await expect(page.locator("text=Governing Law")).toBeVisible();
    await expect(page.locator("text=California, USA")).toBeVisible();
    await expect(page.locator("text=England & Wales, UK")).toBeVisible();
    await expect(page.locator("text=Spain, EU")).toBeVisible();
  });

  test("step 3: language options appear", async ({ page }) => {
    await expect(page.locator("text=Loading contract types")).toBeHidden({ timeout: 10_000 });
    // Select type
    await page.locator("h3", { hasText: "Data Processing Agreement" }).first().click();
    // Select jurisdiction
    await page.locator("text=California, USA").click();

    // Step 3 should appear with language options
    await expect(page.locator("h3", { hasText: "English" })).toBeVisible();
    await expect(page.locator("h3", { hasText: "Español" })).toBeVisible();
  });

  test("step 4: deal name input and summary box", async ({ page }) => {
    await expect(page.locator("text=Loading contract types")).toBeHidden({ timeout: 10_000 });
    await page.locator("h3", { hasText: "Data Processing Agreement" }).first().click();
    await page.locator("text=California, USA").click();

    // Step 4 should have the deal name input
    await expect(page.locator("input#dealName")).toBeVisible();
    // Summary box should show selected contract + jurisdiction
    await expect(page.locator("text=California, USA").nth(1)).toBeVisible();
  });

  test("full flow: DPA -> California -> English -> name -> Continue -> lands on /negotiate", async ({ page }) => {
    await expect(page.locator("text=Loading contract types")).toBeHidden({ timeout: 10_000 });

    // Step 1: Select DPA
    await page.locator("h3", { hasText: "Data Processing Agreement" }).first().click();

    // Step 2: Select California
    await page.locator("text=California, USA").click();

    // Step 3: English is selected by default, no action needed

    // Step 4: Fill deal name
    const dealNameInput = page.locator("input#dealName");
    await expect(dealNameInput).toBeVisible();
    await dealNameInput.fill(`E2E Test Deal ${Date.now()}`);

    // Click Continue
    const continueButton = page.locator("button", { hasText: "Continue" });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    // Should land on negotiate page
    await page.waitForURL("**/negotiate", { timeout: 15_000 });
    await expect(page).toHaveURL(/\/deals\/[^/]+\/negotiate/);
  });

  test("locked skill shows entitlement dialog", async ({ page }) => {
    await expect(page.locator("text=Loading contract types")).toBeHidden({ timeout: 10_000 });
    // Find a locked card (opacity-60 with border-dashed)
    const lockedCards = page.locator("button.opacity-60");
    const count = await lockedCards.count();
    if (count === 0) {
      test.skip(true, "No locked skills to test");
      return;
    }
    await lockedCards.first().click();
    // The entitlement dialog should appear
    await expect(page.locator("[role=dialog]")).toBeVisible();
    await expect(page.locator("text=Access Required").first()).toBeVisible();
  });
});
