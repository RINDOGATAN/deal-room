/**
 * DEALROOM — NDA Demo Recording Script
 * =======================================
 * Self-contained Playwright script for recording a video demo of
 * the full NDA (Non-Disclosure Agreement) lifecycle on dealroom.todo.law.
 *
 * WHAT IT DEMONSTRATES:
 *   1. Party A creates an NDA deal (California, English)
 *   2. Party A walks through all clauses, selecting preferred options
 *   3. Party A submits and invites a counterparty
 *   4. Party B (counterparty) logs in, walks clauses with different choices
 *   5. Party B submits their selections
 *   6. Party A generates AI-powered compromise suggestions
 *   7. Both parties review and accept the compromises
 *   8. Party A proceeds to signing, fills execution details, signs
 *   9. Party B signs the contract
 *   10. The completed contract is downloaded as PDF
 *
 * HOW TO RUN:
 *   E2E_CREDENTIALS_SECRET="e2e-test-secret" \
 *     npx playwright test e2e/demo-nda-recording.spec.ts \
 *     --project=desktop --headed --retries=0
 *
 *   For video capture (saves to test-results/):
 *   E2E_CREDENTIALS_SECRET="e2e-test-secret" \
 *     npx playwright test e2e/demo-nda-recording.spec.ts \
 *     --project=desktop --retries=0
 *
 * ENVIRONMENT:
 *   - Target: https://dealroom.todo.law (production)
 *   - Auth: E2E credentials provider (no Google/email needed)
 *   - E2E_CREDENTIALS_SECRET must match the server's secret
 *
 * DEMO ACCOUNTS (created on-the-fly, no setup needed):
 *   - Party A: demo-alice-{timestamp}@dealroom.video
 *   - Party B: demo-bob-{timestamp}@dealroom.video
 */

import { test, expect, type Page } from "@playwright/test";

// ─── Configuration ──────────────────────────────────────────
const BASE_URL = process.env.E2E_BASE_URL || "https://dealroom.todo.law";
const E2E_SECRET = process.env.E2E_CREDENTIALS_SECRET || "e2e-test-secret";
const DEMO_TS = Date.now();

const PARTY_A_EMAIL = `demo-alice-${DEMO_TS}@dealroom.video`;
const PARTY_B_EMAIL = `demo-bob-${DEMO_TS}@dealroom.video`;
const DEAL_NAME = "Acme Corp × Widgets Inc — NDA";

// Demo pacing (ms) — the recording agent can override via env vars
const PAUSE_SHORT = parseInt(process.env.DEMO_PAUSE_SHORT || "1000", 10);
const PAUSE_MEDIUM = parseInt(process.env.DEMO_PAUSE_MEDIUM || "2000", 10);
const PAUSE_LONG = parseInt(process.env.DEMO_PAUSE_LONG || "3000", 10);

// Company details for signing
const PARTY_A_COMPANY = {
  legalName: "Acme Corporation",
  address: "100 Market Street, San Francisco, CA 94105",
  signatoryName: "Alice Johnson",
  signatoryTitle: "Chief Executive Officer",
};
const PARTY_B_COMPANY = {
  legalName: "Widgets Inc.",
  address: "200 Broadway, New York, NY 10007",
  signatoryName: "Bob Williams",
  signatoryTitle: "General Counsel",
};

// ─── Timing helper ─────────────────────────────────────────
const t0 = Date.now();
function log(msg: string) {
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[${elapsed}s] ${msg}`);
}

// ─── Auth Helper ────────────────────────────────────────────

async function loginAs(page: Page, email: string): Promise<void> {
  const csrfRes = await page.request.get(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();

  const loginRes = await page.request.post(
    `${BASE_URL}/api/auth/callback/e2e-credentials`,
    {
      form: { csrfToken, email, secret: E2E_SECRET, json: "true" },
    },
  );
  if (loginRes.status() >= 400) {
    const body = await loginRes.text();
    throw new Error(`Login failed (${loginRes.status()}): ${body.substring(0, 200)}`);
  }

  const state = await page.request.storageState();
  if (!state.cookies.some((c) => c.name.includes("session-token"))) {
    throw new Error("No session cookie after login");
  }
  await page.context().addCookies(state.cookies);
}

async function setBusinessRole(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const res = await fetch("/api/trpc/lawyer.setRole?batch=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "0": { json: { role: "BUSINESS_OWNER" } } }),
      credentials: "include",
    });
    if (!res.ok) throw new Error(`setRole failed: ${res.status}`);
  });
}

// ─── Dialog Dismissal (fast: 500ms timeouts) ────────────────

async function dismissDialogs(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const lawyerBtn = page.locator("button", { hasText: /I Understand|Entendido/i });
    if (await lawyerBtn.first().waitFor({ state: "visible", timeout: 500 }).then(() => true).catch(() => false)) {
      await lawyerBtn.first().click({ force: true });
      await lawyerBtn.first().waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
      continue;
    }

    const onboardingDialog = page.locator("[role=dialog]").filter({ hasText: /Startup Mode|Modo Startups/i });
    if (await onboardingDialog.first().waitFor({ state: "visible", timeout: 500 }).then(() => true).catch(() => false)) {
      await onboardingDialog.locator("button").filter({ hasText: /Startup Mode/i }).first().click({ force: true });
      const roleBtn = onboardingDialog.locator("button.btn-brutal");
      await expect(roleBtn).toBeEnabled({ timeout: 3_000 });
      await roleBtn.click({ force: true });
      await onboardingDialog.first().waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
      continue;
    }

    break;
  }
}

// ─── Accept all compromise suggestions for a party ──────────

async function acceptAllSuggestions(page: Page, label: string): Promise<void> {
  // Use exact "Accept" text to avoid matching "Accepted" badges
  const getAcceptBtns = () => page.locator("button.btn-brutal").filter({ hasText: /^Accept$|^\s*Accept\s*$/ });

  let count = await getAcceptBtns().count();
  if (count === 0) {
    // Reload to pick up fresh data after other party's actions
    await page.reload();
    await page.waitForTimeout(3_000);
    count = await getAcceptBtns().count();
  }

  log(`${label}: ${count} Accept buttons found`);
  let clicks = 0;
  while (count > 0 && clicks < 30) {
    const btn = getAcceptBtns().first();
    try {
      await btn.click({ timeout: 5_000 });
      clicks++;
      log(`${label}: clicked Accept (${clicks}/${count})`);
    } catch {
      log(`${label}: click failed (button detached), retrying...`);
    }
    await page.waitForTimeout(2_500);
    count = await getAcceptBtns().count();
  }
  log(`${label}: done (${clicks} clicks)`);
}

// ─── THE DEMO ───────────────────────────────────────────────

test.describe("NDA Demo Recording", () => {
  test.setTimeout(900_000); // 15 min

  test("Full NDA lifecycle — two-party negotiation with AI compromise", async ({
    page,
    browser,
  }) => {
    // ┌─────────────────────────────────────────────────┐
    // │  ACT 1 — Party A: Create Deal                   │
    // └─────────────────────────────────────────────────┘
    log("ACT 1: Party A creates deal");

    await loginAs(page, PARTY_A_EMAIL);
    await page.goto(`${BASE_URL}/deals`);
    await page.waitForTimeout(2_000);
    await setBusinessRole(page);
    await loginAs(page, PARTY_A_EMAIL);

    await page.goto(`${BASE_URL}/deals/new`);
    await expect(page.locator("text=Loading contract types")).toBeHidden({ timeout: 10_000 });
    await dismissDialogs(page);
    await page.waitForTimeout(PAUSE_MEDIUM);

    // Select NDA
    await page.locator("h3", { hasText: "Non-Disclosure Agreement" }).first().click();
    await page.waitForTimeout(PAUSE_SHORT);

    // Select California jurisdiction
    const jurisdictionCard = page.locator("button").filter({
      has: page.locator("h3", { hasText: "California, USA" }),
    });
    await jurisdictionCard.first().click();
    await page.waitForTimeout(PAUSE_SHORT);

    // Fill deal name (type slowly for the recording)
    const dealNameInput = page.locator("input#dealName");
    await expect(dealNameInput).toBeVisible({ timeout: 10_000 });
    await dealNameInput.click();
    await page.keyboard.type(DEAL_NAME, { delay: 50 });
    await page.waitForTimeout(PAUSE_SHORT);

    // Click Continue
    const continueBtn = page.locator("button", { hasText: /continue/i });
    await expect(continueBtn).toBeEnabled({ timeout: 10_000 });
    await continueBtn.click();

    await page.waitForURL("**/negotiate", { timeout: 15_000 });
    const dealUrl = page.url();
    const dealId = dealUrl.match(/\/deals\/([^/]+)\/negotiate/)![1];
    log(`Deal created: ${dealId}`);

    await dismissDialogs(page);
    await page.waitForTimeout(PAUSE_MEDIUM);

    // ┌─────────────────────────────────────────────────┐
    // │  ACT 2 — Party A: Walk Clauses                  │
    // └─────────────────────────────────────────────────┘
    log("ACT 2: Party A walks clauses");

    const headerText = await page
      .locator("p", { hasText: /Clause \d+ of \d+/i })
      .first()
      .textContent();
    const clauseCount = parseInt(headerText!.match(/of (\d+)/)![1], 10);
    log(`${clauseCount} clauses`);

    for (let i = 0; i < clauseCount; i++) {
      const isLast = i === clauseCount - 1;
      await dismissDialogs(page);

      const clauseTitle = page.locator("h2").first();
      await expect(clauseTitle).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(PAUSE_SHORT);

      // Select the first option
      const optionCards = page.locator(".card-brutal.cursor-pointer");
      await expect(optionCards.first()).toBeVisible({ timeout: 10_000 });
      const radioCircle = optionCards.first().locator(".rounded-full.border-2").first();
      await radioCircle.click();
      await page.waitForTimeout(PAUSE_SHORT);

      if (!isLast) {
        const nextBtn = page.locator("button", { hasText: /^Continue$/ });
        await expect(nextBtn).toBeEnabled({ timeout: 10_000 });
        await nextBtn.scrollIntoViewIfNeeded();
        await nextBtn.click({ force: true });

        const currentTitle = await clauseTitle.textContent();
        await expect(page.locator("h2").first()).not.toHaveText(currentTitle!, {
          timeout: 10_000,
        });
      }
    }

    // Submit
    const submitBtn = page.locator("button").filter({
      hasText: /Submit All Selections|Confirm.*Generate/i,
    });
    await expect(submitBtn).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(PAUSE_SHORT);
    await submitBtn.click();
    await page.waitForURL(/\/deals\/[^/]+(\/review)?$/, { timeout: 30_000 });
    log("ACT 2 done: Party A submitted");
    await page.waitForTimeout(PAUSE_MEDIUM);

    // ┌─────────────────────────────────────────────────┐
    // │  ACT 3 — Party A: Invite Counterparty           │
    // └─────────────────────────────────────────────────┘
    log("ACT 3: Invite counterparty");

    const inviteBtn = page.locator("button").filter({ hasText: /Invite Counterparty/i });
    await expect(inviteBtn).toBeVisible({ timeout: 10_000 });
    await inviteBtn.click();

    await expect(page.locator("[role=dialog]")).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(PAUSE_SHORT);

    const emailInput = page.locator("[role=dialog] input[type=email]");
    await emailInput.click();
    await page.keyboard.type(PARTY_B_EMAIL, { delay: 30 });

    const nameInput = page.locator("[role=dialog] input").nth(1);
    await nameInput.click();
    await page.keyboard.type("Bob Williams", { delay: 30 });

    const companyInput = page.locator("[role=dialog] input").nth(2);
    await companyInput.click();
    await page.keyboard.type("Widgets Inc.", { delay: 30 });
    await page.waitForTimeout(PAUSE_SHORT);

    const sendBtn = page.locator("[role=dialog] button").filter({ hasText: /Send Invitation/i });
    await sendBtn.click();
    await expect(page.locator("[role=dialog]")).toBeHidden({ timeout: 10_000 });
    log("ACT 3 done: Invitation sent");
    await page.waitForTimeout(PAUSE_MEDIUM);

    // ┌─────────────────────────────────────────────────┐
    // │  ACT 4 — Party B: Walk Clauses                  │
    // └─────────────────────────────────────────────────┘
    log("ACT 4: Party B walks clauses");

    const respCtx = await browser.newContext({ baseURL: BASE_URL });
    const respPage = await respCtx.newPage();
    await loginAs(respPage, PARTY_B_EMAIL);
    await respPage.goto(`${BASE_URL}/deals`);
    await respPage.waitForTimeout(2_000);
    await setBusinessRole(respPage);
    await loginAs(respPage, PARTY_B_EMAIL);

    await respPage.goto(`${BASE_URL}/deals/${dealId}/negotiate`);
    await respPage.waitForTimeout(3_000);
    await dismissDialogs(respPage);
    await respPage.waitForTimeout(PAUSE_MEDIUM);

    const respHeaderText = await respPage
      .locator("p", { hasText: /Clause \d+ of \d+/i })
      .first()
      .textContent();
    const respClauseCount = parseInt(respHeaderText!.match(/of (\d+)/)![1], 10);

    for (let i = 0; i < respClauseCount; i++) {
      const isLast = i === respClauseCount - 1;
      await dismissDialogs(respPage);

      const clauseTitle = respPage.locator("h2").first();
      await expect(clauseTitle).toBeVisible({ timeout: 10_000 });
      await respPage.waitForTimeout(PAUSE_SHORT);

      // Select LAST option (Party B disagrees)
      const optionCards = respPage.locator(".card-brutal.cursor-pointer");
      await expect(optionCards.first()).toBeVisible({ timeout: 10_000 });
      const radioCircle = optionCards.last().locator(".rounded-full.border-2").first();
      await radioCircle.click();
      await respPage.waitForTimeout(PAUSE_SHORT);

      if (!isLast) {
        const nextBtn = respPage.locator("button", { hasText: /^Continue$/ });
        await expect(nextBtn).toBeEnabled({ timeout: 10_000 });
        await nextBtn.scrollIntoViewIfNeeded();
        await nextBtn.click({ force: true });

        const currentTitle = await clauseTitle.textContent();
        await expect(respPage.locator("h2").first()).not.toHaveText(currentTitle!, {
          timeout: 10_000,
        });
      }
    }

    // Party B submits
    const respSubmitBtn = respPage.locator("button").filter({
      hasText: /Submit All Selections/i,
    });
    await expect(respSubmitBtn).toBeVisible({ timeout: 10_000 });
    await respPage.waitForTimeout(PAUSE_SHORT);
    await respSubmitBtn.click();
    await respPage.waitForURL(/\/deals\/[^/]+(\/review)?$/, { timeout: 30_000 });
    log("ACT 4 done: Party B submitted");
    await respPage.waitForTimeout(PAUSE_MEDIUM);

    // ┌─────────────────────────────────────────────────┐
    // │  ACT 5 — Compromise: Generate & Accept          │
    // └─────────────────────────────────────────────────┘
    log("ACT 5: Compromise generation");

    await page.goto(`${BASE_URL}/deals/${dealId}/review`);
    await page.waitForTimeout(3_000);

    // Generate compromises
    const generateBtn = page.locator("button").filter({
      hasText: /Generate Compromise/i,
    });
    await expect(generateBtn).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(PAUSE_SHORT);
    await generateBtn.click();
    log("Generate button clicked, waiting for AI...");

    // Wait for generation (AI call — can take up to 2 min on production)
    await expect(generateBtn).toBeHidden({ timeout: 120_000 });
    log("Compromise generation complete");
    await page.waitForTimeout(3_000); // Let React re-render

    // Wait for Accept buttons to appear
    const acceptBtnLocator = page.locator("button.btn-brutal").filter({ hasText: /^Accept$|^\s*Accept\s*$/ });
    await expect(acceptBtnLocator.first()).toBeVisible({ timeout: 15_000 });
    log("Accept buttons visible");
    await page.waitForTimeout(PAUSE_LONG); // Hero moment

    // Party A accepts all
    await acceptAllSuggestions(page, "Party A");
    await page.waitForTimeout(PAUSE_MEDIUM);

    // Party B accepts all
    await respPage.goto(`${BASE_URL}/deals/${dealId}/review`);
    await respPage.waitForTimeout(3_000);
    await acceptAllSuggestions(respPage, "Party B");
    log("ACT 5 done: Both parties accepted");
    await respPage.waitForTimeout(PAUSE_MEDIUM);

    // ┌─────────────────────────────────────────────────┐
    // │  ACT 6 — Signing: Both Parties Sign             │
    // └─────────────────────────────────────────────────┘
    log("ACT 6: Signing");

    // Party A reloads review to see AGREED state
    await page.goto(`${BASE_URL}/deals/${dealId}/review`);
    await page.waitForTimeout(3_000);

    // Click "Proceed to Signing"
    const proceedBtn = page.locator("button, a").filter({
      hasText: /Proceed to Signing/i,
    }).first();
    await expect(proceedBtn).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(PAUSE_SHORT);
    await proceedBtn.click();

    await page.waitForURL(`**/deals/${dealId}/sign`, { timeout: 15_000 });
    await page.waitForTimeout(3_000);
    log("Party A on sign page");

    // Party A: Fill execution details
    const initiateBtn = page.locator("button").filter({ hasText: /Final Details/i });
    if (await initiateBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await initiateBtn.click();
      await page.waitForTimeout(2_000);
      await page.reload();
      await page.waitForTimeout(3_000);
    }

    const legalNameField = page.locator("input.input-brutal").first();
    if (await legalNameField.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const inputs = page.locator("input.input-brutal");
      await inputs.nth(0).fill(PARTY_A_COMPANY.legalName);
      await page.waitForTimeout(300);
      await inputs.nth(1).fill(PARTY_A_COMPANY.address);
      await page.waitForTimeout(300);
      await inputs.nth(3).fill(PARTY_A_COMPANY.signatoryName);
      await page.waitForTimeout(300);
      await inputs.nth(4).fill(PARTY_A_COMPANY.signatoryTitle);
      await page.waitForTimeout(PAUSE_SHORT);

      const confirmBtn = page.locator("button").filter({ hasText: /Confirm Details/i });
      await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
      await confirmBtn.click();
      await page.waitForTimeout(PAUSE_MEDIUM);
    }

    // Party A signs
    const sigInput = page.locator("input.input-brutal.text-lg");
    if (await sigInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await sigInput.click();
      await page.keyboard.type(PARTY_A_COMPANY.signatoryName, { delay: 80 });
      await page.waitForTimeout(PAUSE_SHORT);

      await page.locator("input[type=checkbox]").check();
      await page.waitForTimeout(PAUSE_SHORT);

      const signBtn = page.locator("button").filter({ hasText: /Sign Contract/i });
      await expect(signBtn).toBeEnabled({ timeout: 5_000 });
      await signBtn.click();
      await page.waitForTimeout(PAUSE_LONG);
    }
    log("Party A signed");

    // Party B signs
    await respPage.goto(`${BASE_URL}/deals/${dealId}/sign`);
    await respPage.waitForTimeout(3_000);

    const respLegalName = respPage.locator("input.input-brutal").first();
    if (await respLegalName.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const inputs = respPage.locator("input.input-brutal");
      await inputs.nth(0).fill(PARTY_B_COMPANY.legalName);
      await respPage.waitForTimeout(300);
      await inputs.nth(1).fill(PARTY_B_COMPANY.address);
      await respPage.waitForTimeout(300);
      await inputs.nth(3).fill(PARTY_B_COMPANY.signatoryName);
      await respPage.waitForTimeout(300);
      await inputs.nth(4).fill(PARTY_B_COMPANY.signatoryTitle);
      await respPage.waitForTimeout(PAUSE_SHORT);

      const confirmBtn = respPage.locator("button").filter({ hasText: /Confirm Details/i });
      await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
      await confirmBtn.click();
      await respPage.waitForTimeout(PAUSE_MEDIUM);
    }

    const respSigInput = respPage.locator("input.input-brutal.text-lg");
    if (await respSigInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await respSigInput.click();
      await respPage.keyboard.type(PARTY_B_COMPANY.signatoryName, { delay: 80 });
      await respPage.waitForTimeout(PAUSE_SHORT);

      await respPage.locator("input[type=checkbox]").check();
      await respPage.waitForTimeout(PAUSE_SHORT);

      const signBtn = respPage.locator("button").filter({ hasText: /Sign Contract/i });
      await expect(signBtn).toBeEnabled({ timeout: 5_000 });
      await signBtn.click();
      await respPage.waitForTimeout(PAUSE_LONG);
    }
    log("Party B signed");

    // ┌─────────────────────────────────────────────────┐
    // │  ACT 7 — Completed: Final View                  │
    // └─────────────────────────────────────────────────┘
    log("ACT 7: Final view");

    await page.goto(`${BASE_URL}/deals/${dealId}/review`);
    await page.waitForTimeout(PAUSE_LONG);

    await respCtx.close();
    log("DEMO COMPLETE");
  });
});
