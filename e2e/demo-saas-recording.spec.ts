/**
 * DEALROOM — SaaS Agreement Demo Recording Script
 * ==================================================
 * Playwright script for recording a video demo of a full SaaS Agreement
 * lifecycle with two-party negotiation, firmness settings, attorney review,
 * AI-powered compromise, and dual signing.
 *
 * WHAT IT DEMONSTRATES:
 *   1. Alice creates a SaaS Agreement deal (California, English)
 *   2. Alice walks all clauses — selects options with varying firmness (1–5)
 *   3. Alice submits and invites Bob as counterparty
 *   4. Bob joins, walks clauses with DIFFERENT choices and firmness
 *   5. Both parties submit → compromise algorithm runs
 *   6. Both review AI compromise suggestions — see how firmness affects outcomes
 *   7. Both accept compromises
 *   8. Alice requests attorney review (lawyer directory modal)
 *   9. Both parties sign the contract
 *   10. Final PDF download
 *
 * HOW TO RUN:
 *   # Headed (watch in real-time):
 *   E2E_CREDENTIALS_SECRET="e2e-test-secret" \
 *     npx playwright test e2e/demo-saas-recording.spec.ts \
 *     --project=desktop --headed --retries=0
 *
 *   # With video capture (saves to test-results/):
 *   E2E_CREDENTIALS_SECRET="e2e-test-secret" \
 *     npx playwright test e2e/demo-saas-recording.spec.ts \
 *     --project=desktop --retries=0
 *
 * DEMO PACING (override via env):
 *   DEMO_PAUSE_SHORT=1000 DEMO_PAUSE_MEDIUM=2000 DEMO_PAUSE_LONG=3000
 *
 * DEMO ACCOUNTS: Created on-the-fly (no setup needed)
 *   - Alice: demo-alice-{ts}@dealroom.video
 *   - Bob:   demo-bob-{ts}@dealroom.video
 */

import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ─── Configuration ──────────────────────────────────────────
const BASE_URL = process.env.E2E_BASE_URL || "https://dealroom.todo.law";
const E2E_SECRET = process.env.E2E_CREDENTIALS_SECRET || "e2e-test-secret";
const DEMO_TS = Date.now();

const ALICE_EMAIL = `demo-alice-${DEMO_TS}@dealroom.video`;
const BOB_EMAIL = `demo-bob-${DEMO_TS}@dealroom.video`;
const DEAL_NAME = "Acme × Widget SaaS";

// Demo pacing (ms)
const PAUSE_SHORT = parseInt(process.env.DEMO_PAUSE_SHORT || "1000", 10);
const PAUSE_MEDIUM = parseInt(process.env.DEMO_PAUSE_MEDIUM || "2000", 10);
const PAUSE_LONG = parseInt(process.env.DEMO_PAUSE_LONG || "3000", 10);

// Company details for signing
const ALICE_COMPANY = {
  legalName: "Acme Corp, Inc.",
  address: "100 Market St, San Francisco, CA 94105",
  signatoryName: "Alice Johnson",
  signatoryTitle: "Chief Executive Officer",
};
const BOB_COMPANY = {
  legalName: "Widget Inc.",
  address: "500 Broadway, New York, NY 10012",
  signatoryName: "Bob Smith",
  signatoryTitle: "Chief Technology Officer",
};

// Firmness presets per clause index (0-indexed).
// Alice is firm on pricing (0) and data portability (6), flexible on SLA (2) and support (4).
// Bob is the opposite — creating an interesting compromise dynamic.
const ALICE_FIRMNESS: Record<number, number> = { 0: 5, 2: 2, 4: 2, 6: 5 };
const BOB_FIRMNESS: Record<number, number> = { 0: 2, 2: 5, 4: 5, 6: 2 };

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
    { form: { csrfToken, email, secret: E2E_SECRET, json: "true" } },
  );
  if (loginRes.status() >= 400) {
    throw new Error(`Login failed (${loginRes.status()})`);
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

// ─── Dialog Dismissal ───────────────────────────────────────

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

// ─── Firmness Slider Helper ─────────────────────────────────

/**
 * Sets the firmness slider to a target value (1–5).
 * Default firmness is 3 (flexibility=3). Uses keyboard arrows to adjust.
 */
async function setFirmness(page: Page, target: number): Promise<void> {
  const DEFAULT_FIRMNESS = 3;
  const delta = target - DEFAULT_FIRMNESS;
  if (delta === 0) return;

  const thumb = page.locator('[data-slot="slider-thumb"]').first();
  const isVisible = await thumb.waitFor({ state: "visible", timeout: 2_000 }).then(() => true).catch(() => false);
  if (!isVisible) return;

  await thumb.focus();
  const key = delta > 0 ? "ArrowRight" : "ArrowLeft";
  for (let i = 0; i < Math.abs(delta); i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(300);
}

// ─── Accept Compromise Suggestions ──────────────────────────

async function acceptAllSuggestions(page: Page, label: string): Promise<void> {
  const getAcceptBtns = () => page.locator("button.btn-brutal").filter({ hasText: /^Accept$|^\s*Accept\s*$/ });

  let count = await getAcceptBtns().count();
  if (count === 0) {
    await page.reload();
    await page.waitForTimeout(3_000);
    count = await getAcceptBtns().count();
  }

  log(`${label}: ${count} Accept buttons found`);
  let clicks = 0;
  while (count > 0 && clicks < 30) {
    const btn = getAcceptBtns().first();
    try {
      await btn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(PAUSE_SHORT);
      await btn.click({ timeout: 5_000 });
      clicks++;
      log(`${label}: accepted (${clicks})`);
    } catch {
      log(`${label}: click failed, retrying...`);
    }
    await page.waitForTimeout(2_500);
    count = await getAcceptBtns().count();
  }
  log(`${label}: done (${clicks} accepted)`);
}

// ─── Sign Contract Helper ───────────────────────────────────

async function signAs(
  page: Page,
  company: typeof ALICE_COMPANY,
  label: string,
): Promise<void> {
  // Initiate signing if "Final Details" button visible
  const initiateBtn = page.locator("button").filter({ hasText: /Final Details/i });
  if (await initiateBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await initiateBtn.click();
    await page.waitForTimeout(2_000);
    await page.reload();
    await page.waitForTimeout(3_000);
  }

  // Fill execution details
  const legalNameField = page.locator("input.input-brutal").first();
  if (await legalNameField.isVisible({ timeout: 5_000 }).catch(() => false)) {
    const inputs = page.locator("input.input-brutal");
    await inputs.nth(0).fill(company.legalName);
    await page.waitForTimeout(300);
    await inputs.nth(1).fill(company.address);
    await page.waitForTimeout(300);
    // Skip taxId (nth(2))
    await inputs.nth(3).fill(company.signatoryName);
    await page.waitForTimeout(300);
    await inputs.nth(4).fill(company.signatoryTitle);
    await page.waitForTimeout(PAUSE_SHORT);

    const confirmBtn = page.locator("button").filter({ hasText: /Confirm Details/i });
    await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
    await confirmBtn.click();
    await page.waitForTimeout(PAUSE_MEDIUM);
  }

  // Type signature (slow for visual effect)
  const sigInput = page.locator("input.input-brutal.text-lg");
  if (await sigInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await sigInput.click();
    await page.keyboard.type(company.signatoryName, { delay: 80 });
    await page.waitForTimeout(PAUSE_SHORT);

    await page.locator("input[type=checkbox]").check();
    await page.waitForTimeout(PAUSE_SHORT);

    const signBtn = page.locator("button").filter({ hasText: /Sign Contract/i });
    await expect(signBtn).toBeEnabled({ timeout: 5_000 });
    await signBtn.click();
    await page.waitForTimeout(PAUSE_LONG);
  }

  log(`${label} signed`);
}

// ─── THE DEMO ───────────────────────────────────────────────

test.describe("SaaS Agreement Demo Recording", () => {
  test.setTimeout(900_000); // 15 min

  test("Full SaaS lifecycle — negotiation, firmness, attorney review, compromise, signing", async ({
    page,
    browser,
  }) => {
    // ┌─────────────────────────────────────────────────┐
    // │  ACT 1 — Alice: Create the Deal                  │
    // └─────────────────────────────────────────────────┘
    log("ACT 1: Alice creates deal");

    await loginAs(page, ALICE_EMAIL);
    await page.goto(`${BASE_URL}/deals`);
    await page.waitForTimeout(2_000);
    await setBusinessRole(page);
    await loginAs(page, ALICE_EMAIL);

    // Navigate to new deal page
    await page.goto(`${BASE_URL}/deals/new`);
    await expect(page.locator("text=Loading contract types")).toBeHidden({ timeout: 10_000 });
    await dismissDialogs(page);
    await page.waitForTimeout(PAUSE_MEDIUM);

    // Select SaaS Agreement
    await page.locator("h3", { hasText: "SaaS Subscription Agreement" }).first().click();
    await page.waitForTimeout(PAUSE_SHORT);

    // Select California jurisdiction
    const jurisdictionCard = page.locator("button").filter({
      has: page.locator("h3", { hasText: "California, USA" }),
    });
    await jurisdictionCard.first().click();
    await page.waitForTimeout(PAUSE_SHORT);

    // English is auto-selected — no action needed

    // Type deal name slowly for the recording
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
    // │  ACT 2 — Alice: Walk Clauses with Firmness       │
    // └─────────────────────────────────────────────────┘
    log("ACT 2: Alice walks clauses");

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
      const titleText = await clauseTitle.textContent();
      await page.waitForTimeout(PAUSE_SHORT);

      // Select the FIRST option (Alice's preferred choices)
      const optionCards = page.locator(".card-brutal.cursor-pointer");
      await expect(optionCards.first()).toBeVisible({ timeout: 10_000 });
      const radioCircle = optionCards.first().locator(".rounded-full.border-2").first();
      await radioCircle.click();
      await page.waitForTimeout(PAUSE_SHORT);

      // Adjust firmness if this clause has a preset
      if (ALICE_FIRMNESS[i] !== undefined) {
        await setFirmness(page, ALICE_FIRMNESS[i]);
        log(`  Clause ${i + 1} "${titleText}": firmness → ${ALICE_FIRMNESS[i]}/5`);
      }

      if (isLast) {
        const submitBtn = page.locator("button").filter({
          hasText: /Submit All Selections|Confirm.*Generate/i,
        });
        await expect(submitBtn).toBeVisible({ timeout: 10_000 });
      } else {
        const nextBtn = page.locator("button", { hasText: /^Continue$/ });
        await expect(nextBtn).toBeEnabled({ timeout: 10_000 });
        await nextBtn.scrollIntoViewIfNeeded();
        await nextBtn.click({ force: true });

        await expect(page.locator("h2").first()).not.toHaveText(titleText!, {
          timeout: 10_000,
        });
      }
    }

    // Submit selections
    const aliceSubmitBtn = page.locator("button").filter({
      hasText: /Submit All Selections/i,
    });
    await expect(aliceSubmitBtn).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(PAUSE_SHORT);
    await aliceSubmitBtn.click();
    await page.waitForURL(/\/deals\/[^/]+(\/review)?$/, { timeout: 30_000 });
    log("ACT 2 done: Alice submitted");
    await page.waitForTimeout(PAUSE_MEDIUM);

    // ┌─────────────────────────────────────────────────┐
    // │  ACT 3 — Alice: Invite Bob                       │
    // └─────────────────────────────────────────────────┘
    log("ACT 3: Invite Bob");

    const inviteBtn = page.locator("button").filter({ hasText: /Invite Counterparty/i });
    await expect(inviteBtn).toBeVisible({ timeout: 10_000 });
    await inviteBtn.click();

    await expect(page.locator("[role=dialog]")).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(PAUSE_SHORT);

    // Type slowly for the recording
    const emailInput = page.locator("[role=dialog] input[type=email]");
    await emailInput.click();
    await page.keyboard.type(BOB_EMAIL, { delay: 30 });

    const nameInput = page.locator("[role=dialog] input").nth(1);
    await nameInput.click();
    await page.keyboard.type("Bob Smith", { delay: 30 });

    const companyInput = page.locator("[role=dialog] input").nth(2);
    await companyInput.click();
    await page.keyboard.type("Widget Inc.", { delay: 30 });
    await page.waitForTimeout(PAUSE_SHORT);

    const sendBtn = page.locator("[role=dialog] button").filter({ hasText: /Send Invitation/i });
    await sendBtn.click();
    await expect(page.locator("[role=dialog]")).toBeHidden({ timeout: 10_000 });
    log("ACT 3 done: Invitation sent");
    await page.waitForTimeout(PAUSE_MEDIUM);

    // ┌─────────────────────────────────────────────────┐
    // │  ACT 4 — Bob: Walk Clauses (Different Choices)   │
    // └─────────────────────────────────────────────────┘
    log("ACT 4: Bob walks clauses");

    const bobCtx = await browser.newContext({ baseURL: BASE_URL });
    const bobPage = await bobCtx.newPage();
    await loginAs(bobPage, BOB_EMAIL);
    await bobPage.goto(`${BASE_URL}/deals`);
    await bobPage.waitForTimeout(2_000);
    await setBusinessRole(bobPage);
    await loginAs(bobPage, BOB_EMAIL);

    await bobPage.goto(`${BASE_URL}/deals/${dealId}/negotiate`);
    await bobPage.waitForTimeout(3_000);
    await dismissDialogs(bobPage);
    await bobPage.waitForTimeout(PAUSE_MEDIUM);

    const bobHeaderText = await bobPage
      .locator("p", { hasText: /Clause \d+ of \d+/i })
      .first()
      .textContent();
    const bobClauseCount = parseInt(bobHeaderText!.match(/of (\d+)/)![1], 10);

    for (let i = 0; i < bobClauseCount; i++) {
      const isLast = i === bobClauseCount - 1;
      await dismissDialogs(bobPage);

      const clauseTitle = bobPage.locator("h2").first();
      await expect(clauseTitle).toBeVisible({ timeout: 10_000 });
      const titleText = await clauseTitle.textContent();
      await bobPage.waitForTimeout(PAUSE_SHORT);

      // Bob selects the LAST option (opposite of Alice)
      const optionCards = bobPage.locator(".card-brutal.cursor-pointer");
      await expect(optionCards.first()).toBeVisible({ timeout: 10_000 });
      const radioCircle = optionCards.last().locator(".rounded-full.border-2").first();
      await radioCircle.click();
      await bobPage.waitForTimeout(PAUSE_SHORT);

      // Adjust Bob's firmness
      if (BOB_FIRMNESS[i] !== undefined) {
        await setFirmness(bobPage, BOB_FIRMNESS[i]);
        log(`  Clause ${i + 1} "${titleText}": Bob firmness → ${BOB_FIRMNESS[i]}/5`);
      }

      if (isLast) {
        const submitBtn = bobPage.locator("button").filter({
          hasText: /Submit All Selections/i,
        });
        await expect(submitBtn).toBeVisible({ timeout: 10_000 });
      } else {
        const nextBtn = bobPage.locator("button", { hasText: /^Continue$/ });
        await expect(nextBtn).toBeEnabled({ timeout: 10_000 });
        await nextBtn.scrollIntoViewIfNeeded();
        await nextBtn.click({ force: true });

        await expect(bobPage.locator("h2").first()).not.toHaveText(titleText!, {
          timeout: 10_000,
        });
      }
    }

    // Bob submits
    const bobSubmitBtn = bobPage.locator("button").filter({
      hasText: /Submit All Selections/i,
    });
    await expect(bobSubmitBtn).toBeVisible({ timeout: 10_000 });
    await bobPage.waitForTimeout(PAUSE_SHORT);
    await bobSubmitBtn.click();
    await bobPage.waitForURL(/\/deals\/[^/]+(\/review)?$/, { timeout: 30_000 });
    log("ACT 4 done: Bob submitted");
    await bobPage.waitForTimeout(PAUSE_MEDIUM);

    // ┌─────────────────────────────────────────────────┐
    // │  ACT 5 — Compromise: Generate & Review           │
    // └─────────────────────────────────────────────────┘
    log("ACT 5: Compromise generation");

    await page.goto(`${BASE_URL}/deals/${dealId}/review`);
    await page.waitForTimeout(3_000);

    // Generate compromise suggestions
    const generateBtn = page.locator("button").filter({
      hasText: /Generate Compromise/i,
    });
    await expect(generateBtn).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(PAUSE_SHORT);
    await generateBtn.click();
    log("Generate button clicked, waiting for AI...");

    // Wait for generation (can take up to 2 min)
    await expect(generateBtn).toBeHidden({ timeout: 120_000 });
    log("Compromise generation complete");
    await page.waitForTimeout(3_000);

    // Wait for Accept buttons to appear — this is the hero moment
    const acceptBtnLocator = page.locator("button.btn-brutal").filter({
      hasText: /^Accept$|^\s*Accept\s*$/,
    });
    await expect(acceptBtnLocator.first()).toBeVisible({ timeout: 15_000 });
    log("Accept buttons visible");
    await page.waitForTimeout(PAUSE_LONG);

    // Alice accepts all compromise suggestions
    await acceptAllSuggestions(page, "Alice");
    await page.waitForTimeout(PAUSE_MEDIUM);

    // Bob accepts all compromise suggestions
    await bobPage.goto(`${BASE_URL}/deals/${dealId}/review`);
    await bobPage.waitForTimeout(3_000);
    await acceptAllSuggestions(bobPage, "Bob");
    log("ACT 5 done: Both parties accepted compromises");
    await bobPage.waitForTimeout(PAUSE_MEDIUM);

    // ┌─────────────────────────────────────────────────┐
    // │  ACT 6 — Attorney Review Request                 │
    // └─────────────────────────────────────────────────┘
    log("ACT 6: Attorney review");

    // Reload Alice's review page to see AGREED state
    await page.goto(`${BASE_URL}/deals/${dealId}/review`);
    await page.waitForTimeout(3_000);

    // Look for "Request Attorney Review" button
    const reviewBtn = page.locator("button").filter({
      hasText: /Request Attorney Review|Solicitar Revisión/i,
    });
    const hasReviewBtn = await reviewBtn.first()
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (hasReviewBtn) {
      await page.waitForTimeout(PAUSE_SHORT);
      await reviewBtn.first().click();
      log("Attorney review modal opened");

      // Wait for the attorney selection dialog
      const dialog = page.locator("[role=dialog]");
      await expect(dialog).toBeVisible({ timeout: 5_000 });
      await page.waitForTimeout(PAUSE_MEDIUM);

      // Select the first available attorney (if any listed)
      const attorneyCards = dialog.locator("button").filter({
        hasNotText: /Cancel|Cancelar|Assign|Asignar|Close/i,
      });
      const hasAttorneys = await attorneyCards.first()
        .waitFor({ state: "visible", timeout: 3_000 })
        .then(() => true)
        .catch(() => false);

      if (hasAttorneys) {
        await attorneyCards.first().click();
        await page.waitForTimeout(PAUSE_SHORT);

        // Click "Assign Attorney"
        const assignBtn = dialog.locator("button").filter({
          hasText: /Assign Attorney|Asignar Abogado/i,
        });
        const canAssign = await assignBtn.first()
          .waitFor({ state: "visible", timeout: 3_000 })
          .then(() => true)
          .catch(() => false);

        if (canAssign) {
          await assignBtn.first().click();
          await page.waitForTimeout(PAUSE_MEDIUM);
          log("Attorney assigned — review requested");
        }
      } else {
        // No attorneys available — close dialog and continue
        const closeBtn = dialog.locator("button").filter({ hasText: /Cancel|Close|Cancelar/i });
        if (await closeBtn.first().isVisible().catch(() => false)) {
          await closeBtn.first().click();
        }
        log("No attorneys available — skipping review request");
      }
    } else {
      log("Attorney review button not visible — contract may be lawyer-vetted");
    }

    await page.waitForTimeout(PAUSE_MEDIUM);
    // NOTE: In a full demo, the lawyer would log into the Supervisor Portal
    // at /supervise, review the contract clause-by-clause, and click "Approve Review".
    // The automated script proceeds to signing (attorney review is optional).

    // ┌─────────────────────────────────────────────────┐
    // │  ACT 7 — Signing: Both Parties Sign              │
    // └─────────────────────────────────────────────────┘
    log("ACT 7: Signing");

    // Alice navigates to signing
    await page.goto(`${BASE_URL}/deals/${dealId}/review`);
    await page.waitForTimeout(3_000);

    const proceedBtn = page.locator("button, a").filter({
      hasText: /Proceed to Signing/i,
    }).first();
    await expect(proceedBtn).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(PAUSE_SHORT);
    await proceedBtn.click();

    await page.waitForURL(`**/deals/${dealId}/sign`, { timeout: 15_000 });
    await page.waitForTimeout(3_000);

    // Alice signs
    await signAs(page, ALICE_COMPANY, "Alice");
    await page.waitForTimeout(PAUSE_MEDIUM);

    // Bob signs
    await bobPage.goto(`${BASE_URL}/deals/${dealId}/sign`);
    await bobPage.waitForTimeout(3_000);
    await signAs(bobPage, BOB_COMPANY, "Bob");
    await bobPage.waitForTimeout(PAUSE_MEDIUM);

    // ┌─────────────────────────────────────────────────┐
    // │  ACT 8 — Complete: Final View + PDF Download     │
    // └─────────────────────────────────────────────────┘
    log("ACT 8: Final view");

    // Show completed deal
    await page.goto(`${BASE_URL}/deals/${dealId}/review`);
    await page.waitForTimeout(PAUSE_LONG);

    // Download the final PDF
    const pdfDir = path.join(process.cwd(), "test-results", "demo-pdfs");
    fs.mkdirSync(pdfDir, { recursive: true });

    const response = await page.request.get(`/api/deals/${dealId}/document`);
    if (response.status() === 200) {
      const buffer = await response.body();
      const pdfPath = path.join(pdfDir, `saas-demo-${DEMO_TS}.pdf`);
      fs.writeFileSync(pdfPath, buffer);
      log(`PDF saved: ${pdfPath}`);
    } else {
      log(`PDF download returned ${response.status()} — deal may not be in signable state`);
    }

    await page.waitForTimeout(PAUSE_LONG);

    // Clean up
    await bobCtx.close();
    log("DEMO COMPLETE");
  });
});
