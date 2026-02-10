import { type Page, expect } from "@playwright/test";

export interface DealOptions {
  contractType: string; // h3 text on template card, e.g. "Data Processing Agreement"
  jurisdiction: string; // button text, e.g. "California, USA"
  language: string; // h3 nativeLabel, e.g. "English" or "Español"
  dealName: string;
}

/**
 * Creates a deal through the wizard and navigates to /negotiate.
 * Returns the deal ID extracted from the URL.
 */
export async function createDealWithOptions(
  page: Page,
  options: DealOptions,
): Promise<string> {
  await page.goto("/deals/new");
  await expect(page.locator("text=Loading contract types")).toBeHidden({
    timeout: 10_000,
  });

  // Step 1: Select contract type
  await page.locator("h3", { hasText: options.contractType }).first().click();

  // Step 2: Select jurisdiction
  await page.locator("text=" + options.jurisdiction).click();

  // Step 3: Select language (English is auto-selected; click if different)
  if (options.language !== "English") {
    await page
      .locator("h3", { hasText: options.language })
      .first()
      .click();
  }

  // Step 4: Fill deal name
  const dealNameInput = page.locator("input#dealName");
  await expect(dealNameInput).toBeVisible();
  await dealNameInput.fill(options.dealName);

  // Submit
  const continueButton = page.locator("button", { hasText: /continue|continuar/i });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();

  // Wait for negotiate page
  await page.waitForURL("**/negotiate", { timeout: 15_000 });

  // Extract deal ID from URL
  const url = page.url();
  const match = url.match(/\/deals\/([^/]+)\/negotiate/);
  if (!match) throw new Error(`Could not extract deal ID from URL: ${url}`);
  return match[1];
}

/**
 * Reads the clause count from the negotiate page header ("Clause X of Y").
 */
export async function getClauseCount(page: Page): Promise<number> {
  const headerText = await page
    .locator("p", { hasText: /Clause \d+ of \d+/i })
    .first()
    .textContent();
  const match = headerText?.match(/of (\d+)/);
  if (!match) throw new Error(`Could not extract clause count from: ${headerText}`);
  return parseInt(match[1], 10);
}

/**
 * Walks through all clauses on the negotiate page:
 * - Verifies each clause title (h2) is visible
 * - Clicks the radio circle on the first option card to select it
 * - Waits for Continue to become enabled, then clicks
 * - On the last clause, verifies submit-related UI instead of clicking Continue
 */
export async function walkAllClauses(
  page: Page,
  expectedCount: number,
): Promise<void> {
  for (let i = 0; i < expectedCount; i++) {
    const isLast = i === expectedCount - 1;

    // Verify clause title is visible
    const clauseTitle = page.locator("h2").first();
    await expect(clauseTitle).toBeVisible({ timeout: 10_000 });
    const currentTitle = await clauseTitle.textContent();

    // Verify option cards exist
    const optionCards = page.locator(".card-brutal.cursor-pointer");
    await expect(optionCards.first()).toBeVisible({ timeout: 10_000 });

    // Click the radio circle (top-left of card) to avoid the expand button
    // and the expanded content area which both have stopPropagation
    const radioCircle = optionCards.first().locator(".rounded-full.border-2").first();
    await radioCircle.click();

    if (isLast) {
      // On the last clause, verify submit button is visible
      const submitButton = page.locator(
        "button",
        { hasText: /submit|enviar/i },
      );
      await expect(submitButton).toBeVisible({ timeout: 10_000 });
    } else {
      // Wait for Continue button to become enabled after selection
      const continueButton = page.locator("button", {
        hasText: /^Continue$|^Continuar$/,
      });
      await expect(continueButton).toBeEnabled({ timeout: 10_000 });
      // On mobile, the Importance Settings card can overlap the button,
      // so scroll it into view and use force click
      await continueButton.scrollIntoViewIfNeeded();
      await continueButton.click({ force: true });

      // Wait for the clause title to change (confirms next clause loaded)
      await expect(page.locator("h2").first()).not.toHaveText(currentTitle!, {
        timeout: 10_000,
      });
    }
  }
}
