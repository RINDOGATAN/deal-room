import { test, expect, type Page } from "@playwright/test";
import { trialLogin } from "./helpers/auth";

const REQUIRED_PARAMS = [
  "pre-money-valuation",
  "investment-amount",
  "share-count",
  "share-price",
  "board-size",
] as const;

const REQUIRED_VALUES: Record<string, string> = {
  "pre-money-valuation": "2000000",
  "investment-amount": "500000",
  "share-count": "500000",
  "share-price": "1",
  "board-size": "3",
};

/**
 * Navigate to Seed Investment, California, English, Step 4 (parameters).
 */
async function navigateToSeedStep4(page: Page) {
  await page.goto("/deals/new");
  await expect(page.locator("text=Loading contract types")).toBeHidden({ timeout: 10_000 });

  // Step 1: Select Seed Investment
  await page.locator("h3", { hasText: "Seed Investment Agreement" }).first().click();

  // Step 2: Select California
  await page.locator("text=California, USA").click();

  // Step 3: English is auto-selected

  // Step 4: Wait for deal name input and parameter fields
  await expect(page.locator("input#dealName")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#param-board-size")).toBeVisible({ timeout: 5_000 });
}

test.describe("Parameter Validation — Seed Investment", () => {
  test.beforeEach(async ({ page }) => {
    await trialLogin(page);
  });

  test("required params block submission when all empty", async ({ page }) => {
    test.setTimeout(60_000);
    await navigateToSeedStep4(page);

    // Fill only deal name, leave all params empty
    await page.locator("input#dealName").fill(`ParamEmpty ${Date.now()}`);

    // Clear all param fields (they may have defaults)
    for (const paramId of REQUIRED_PARAMS) {
      await page.locator(`#param-${paramId}`).fill("");
    }

    // Click Continue
    const continueButton = page.locator("button", { hasText: /continue|continuar/i });
    await continueButton.click();

    // Toast should appear
    const toast = page.locator("[data-sonner-toast]").first();
    await expect(toast).toBeVisible({ timeout: 5_000 });

    // Should still be on /deals/new
    expect(page.url()).toContain("/deals/new");
  });

  test("missing single required param shows its label in toast", async ({ page }) => {
    test.setTimeout(60_000);
    await navigateToSeedStep4(page);

    await page.locator("input#dealName").fill(`ParamSingle ${Date.now()}`);

    // Fill all required params except board-size
    for (const paramId of REQUIRED_PARAMS) {
      const input = page.locator(`#param-${paramId}`);
      if (paramId === "board-size") {
        await input.fill("");
      } else {
        await input.fill(REQUIRED_VALUES[paramId]);
      }
    }

    // Click Continue
    const continueButton = page.locator("button", { hasText: /continue|continuar/i });
    await continueButton.click();

    // Toast should mention "Board Size"
    const toast = page.locator("[data-sonner-toast]").first();
    await expect(toast).toBeVisible({ timeout: 5_000 });
    await expect(toast).toContainText("Board Size");

    // Should still be on /deals/new
    expect(page.url()).toContain("/deals/new");
  });

  test("error styling on missing param inputs after failed submit", async ({ page }) => {
    test.setTimeout(60_000);
    await navigateToSeedStep4(page);

    await page.locator("input#dealName").fill(`ParamStyle ${Date.now()}`);

    // Clear all required params
    for (const paramId of REQUIRED_PARAMS) {
      await page.locator(`#param-${paramId}`).fill("");
    }

    // Click Continue
    const continueButton = page.locator("button", { hasText: /continue|continuar/i });
    await continueButton.click();

    // Wait for toast (confirms validation ran)
    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({ timeout: 5_000 });

    // Each required input should have border-destructive class
    for (const paramId of REQUIRED_PARAMS) {
      const input = page.locator(`#param-${paramId}`);
      await expect(input).toHaveClass(/border-destructive/);
    }
  });

  test("valid params allow navigation to /negotiate", async ({ page }) => {
    test.setTimeout(60_000);
    await navigateToSeedStep4(page);

    await page.locator("input#dealName").fill(`ParamValid ${Date.now()}`);

    // Fill all required params
    for (const paramId of REQUIRED_PARAMS) {
      await page.locator(`#param-${paramId}`).fill(REQUIRED_VALUES[paramId]);
    }

    // Click Continue
    const continueButton = page.locator("button", { hasText: /continue|continuar/i });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    // Should navigate to /negotiate
    await page.waitForURL("**/negotiate", { timeout: 15_000 });
    await expect(page).toHaveURL(/\/deals\/[^/]+\/negotiate/);
  });

  test("optional params can be empty and still succeed", async ({ page }) => {
    test.setTimeout(60_000);
    await navigateToSeedStep4(page);

    await page.locator("input#dealName").fill(`ParamOptional ${Date.now()}`);

    // Fill only required params
    for (const paramId of REQUIRED_PARAMS) {
      await page.locator(`#param-${paramId}`).fill(REQUIRED_VALUES[paramId]);
    }

    // Clear optional params that may have defaults
    const optionalParams = ["dividend-rate", "qualified-financing-threshold", "lock-up-months", "legal-fee-cap"];
    for (const paramId of optionalParams) {
      const input = page.locator(`#param-${paramId}`);
      if (await input.isVisible()) {
        await input.fill("");
      }
    }

    // Click Continue
    const continueButton = page.locator("button", { hasText: /continue|continuar/i });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    // Should still navigate successfully to /negotiate
    await page.waitForURL("**/negotiate", { timeout: 15_000 });
    await expect(page).toHaveURL(/\/deals\/[^/]+\/negotiate/);
  });
});
