import { test, expect } from "@playwright/test";
import { trialLogin } from "./helpers/auth";
import { createDealWithOptions } from "./helpers/deal";

test.describe("Navigation & Auth", () => {
  test("deep link to /deals/fake-id/negotiate redirects to /sign-in", async ({ page }) => {
    test.setTimeout(15_000);
    await page.goto("/deals/fake-id-12345/negotiate");
    await page.waitForURL("**/sign-in", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("page refresh resets clause index to first clause", async ({ page }) => {
    test.setTimeout(90_000);
    await trialLogin(page);

    await createDealWithOptions(page, {
      contractType: "Data Processing Agreement",
      jurisdiction: "California, USA",
      language: "English",
      dealName: `NavRefresh ${Date.now()}`,
    });

    // Should be on clause 1 — get the title
    const firstTitle = await page.locator("h2").first().textContent();
    expect(firstTitle).toBeTruthy();

    // Select an option and advance to clause 2
    const optionCards = page.locator(".card-brutal.cursor-pointer");
    await expect(optionCards.first()).toBeVisible({ timeout: 10_000 });
    const radioCircle = optionCards.first().locator(".rounded-full.border-2").first();
    await radioCircle.click();

    const continueButton = page.locator("button", { hasText: /^Continue$|^Continuar$/ });
    await expect(continueButton).toBeEnabled({ timeout: 10_000 });
    await continueButton.scrollIntoViewIfNeeded();
    await continueButton.click({ force: true });

    // Wait for clause title to change (now on clause 2)
    await expect(page.locator("h2").first()).not.toHaveText(firstTitle!, { timeout: 10_000 });

    // Reload the page
    await page.reload();

    // Should reset back to clause 1 title
    await expect(page.locator("h2").first()).toHaveText(firstTitle!, { timeout: 15_000 });
  });

  test("browser back exits negotiate page", async ({ page }) => {
    test.setTimeout(90_000);
    await trialLogin(page);

    await createDealWithOptions(page, {
      contractType: "Data Processing Agreement",
      jurisdiction: "California, USA",
      language: "English",
      dealName: `NavBack ${Date.now()}`,
    });

    // Verify we're on the negotiate page
    await expect(page).toHaveURL(/\/negotiate/);

    // Select an option so we have some state
    const optionCards = page.locator(".card-brutal.cursor-pointer");
    await expect(optionCards.first()).toBeVisible({ timeout: 10_000 });
    await optionCards.first().locator(".rounded-full.border-2").first().click();

    // Go back
    await page.goBack();

    // URL should no longer contain /negotiate
    await page.waitForURL((url) => !url.pathname.includes("/negotiate"), { timeout: 10_000 });
    expect(page.url()).not.toContain("/negotiate");
  });

  test("direct URL to deal detail page loads correctly", async ({ page }) => {
    test.setTimeout(60_000);
    await trialLogin(page);

    const dealName = `NavDirect ${Date.now()}`;
    const dealId = await createDealWithOptions(page, {
      contractType: "Data Processing Agreement",
      jurisdiction: "California, USA",
      language: "English",
      dealName,
    });

    // Navigate directly to deal detail via URL
    await page.goto(`/deals/${dealId}`);

    // h1 should show the deal name
    await expect(page.locator("h1", { hasText: dealName })).toBeVisible({ timeout: 10_000 });
  });
});
