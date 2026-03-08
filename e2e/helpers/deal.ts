import { type Page, expect } from "@playwright/test";

export interface DealOptions {
  contractType: string; // h3 text on template card, e.g. "Data Processing Agreement"
  jurisdiction: string; // button text, e.g. "California, USA"
  language: string; // h3 nativeLabel, e.g. "English" or "Español"
  dealName: string;
  parameters?: Record<string, string>; // keyed by param.id → value (e.g. "pre-money-valuation" → "2000000")
}

/**
 * Dismisses any blocking dialog (role selection, lawyer warning, etc.)
 * by looking for common dismiss buttons.
 */
export async function dismissDialogs(page: Page): Promise<void> {
  // Loop to handle multiple sequential dialogs (e.g. lawyer warning + role selection)
  for (let attempt = 0; attempt < 3; attempt++) {
    // "Proceeding Without a Lawyer" → click "I Understand" / "Entendido"
    const lawyerBtn = page.locator("button", { hasText: /I Understand|Entendido/i });
    const hasLawyer = await lawyerBtn.first().waitFor({ state: "visible", timeout: 3_000 }).then(() => true).catch(() => false);
    if (hasLawyer) {
      // force: true bypasses overlay interception when multiple dialogs stack
      await lawyerBtn.first().click({ force: true });
      await lawyerBtn.first().waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
      continue; // Check for more dialogs
    }

    // "How will you use Dealroom?" → click "Startup Mode" card button, then "Continue as Business"
    const onboardingDialog = page.locator("[role=dialog]").filter({ hasText: /Startup Mode|Modo Startups/i });
    const hasOnboarding = await onboardingDialog.first().waitFor({ state: "visible", timeout: 2_000 }).then(() => true).catch(() => false);
    if (hasOnboarding) {
      // Click the card button containing "Startup Mode" / "Modo Startups"
      const startupBtn = onboardingDialog.locator("button").filter({ hasText: /Startup Mode|Modo Startups/i });
      await startupBtn.first().click({ force: true });
      // After selecting, the bottom submit button text changes to "Continue as Business"
      const roleBtn = onboardingDialog.locator("button.btn-brutal");
      await expect(roleBtn).toBeEnabled({ timeout: 3_000 });
      await roleBtn.click({ force: true });
      await onboardingDialog.first().waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
      continue; // Check for more dialogs
    }

    break; // No more dialogs found
  }
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

  // Dismiss any blocking dialog (role selection etc.)
  await dismissDialogs(page);

  // Step 1: Select contract type
  await page.locator("h3", { hasText: options.contractType }).first().click();

  // Step 2: Select jurisdiction (soloModeOnly templates skip this)
  // Use h3 inside button to match jurisdiction cards, not parameter chip buttons
  const jurisdictionCard = page.locator("button").filter({
    has: page.locator("h3", { hasText: options.jurisdiction }),
  });
  const hasJurisdictionStep = await jurisdictionCard.first().waitFor({ state: "visible", timeout: 3_000 }).then(() => true).catch(() => false);
  if (hasJurisdictionStep) {
    await jurisdictionCard.first().click();
  }

  // Step 3: Select language (English is auto-selected; click if different)
  if (options.language !== "English") {
    const langCard = page.locator("h3", { hasText: options.language }).first();
    // Wait for card to be enabled (may animate in after jurisdiction selection)
    await expect(langCard).toBeVisible({ timeout: 5_000 });
    // Use force click in case the card is still settling
    await langCard.click({ force: true, timeout: 10_000 });
  }

  // Step 4: Fill deal name
  const dealNameInput = page.locator("input#dealName");
  await expect(dealNameInput).toBeVisible({ timeout: 10_000 });
  await dealNameInput.fill(options.dealName);

  // Fill optional parameters (Seed Investment etc.)
  if (options.parameters) {
    for (const [paramId, value] of Object.entries(options.parameters)) {
      // Jurisdiction chips are toggled by clicking, not filling an input
      if (paramId === "jurisdictions") {
        for (const j of value.split("|")) {
          const chipText = j.trim();
          // Match partial text in jurisdiction chip buttons
          const chip = page.locator("button", { hasText: new RegExp(chipText.replace(/_/g, ".*"), "i") });
          // waitFor actually waits (unlike isVisible which returns immediately)
          const visible = await chip.first().waitFor({ state: "visible", timeout: 5_000 }).then(() => true).catch(() => false);
          if (visible) await chip.first().click();
        }
        continue;
      }
      const input = page.locator(`#param-${paramId}`);
      // waitFor actually waits for the element to appear
      const visible = await input.waitFor({ state: "visible", timeout: 5_000 }).then(() => true).catch(() => false);
      if (visible) await input.fill(value);
    }
  }

  // Submit
  const continueButton = page.locator("button", { hasText: /continue|continuar/i });
  await expect(continueButton).toBeEnabled({ timeout: 10_000 });
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
  await dismissDialogs(page);
  const headerText = await page
    .locator("p", { hasText: /(?:Clause|Cl[aá]usula) \d+ (?:of|de) \d+/i })
    .first()
    .textContent();
  const match = headerText?.match(/(?:of|de) (\d+)/);
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
  selectLast = false,
): Promise<void> {
  // Dismiss any blocking dialog ("Proceeding Without a Lawyer" etc.)
  await dismissDialogs(page);

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
    const targetCard = selectLast ? optionCards.last() : optionCards.first();
    const radioCircle = targetCard.locator(".rounded-full.border-2").first();
    await radioCircle.click();

    if (isLast) {
      // On the last clause, verify submit button is visible
      const submitButton = page.locator(
        "button",
        { hasText: /submit|enviar|confirm.*generate|confirmar.*generar/i },
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
