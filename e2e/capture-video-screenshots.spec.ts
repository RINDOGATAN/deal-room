/**
 * Capture Screenshots for TODO.LAW Promo Video
 * ==============================================
 * Runs the same NDA flow as demo-nda-recording.spec.ts but captures
 * 1920×1080 screenshots at key moments for the Remotion video composition.
 *
 * Output: 6 PNG files in ../todolaw/videos/public/
 *
 * HOW TO RUN:
 *   E2E_CREDENTIALS_SECRET="e2e-test-secret" \
 *     npx playwright test e2e/capture-video-screenshots.spec.ts \
 *     --project=desktop --retries=0
 */

import { test, expect, type Page } from "@playwright/test";
import path from "path";

// ─── Configuration ──────────────────────────────────────────
const BASE_URL = process.env.E2E_BASE_URL || "https://dealroom.todo.law";
const E2E_SECRET = process.env.E2E_CREDENTIALS_SECRET || "e2e-test-secret";
const DEMO_TS = Date.now();

const PARTY_A_EMAIL = `video-alice-${DEMO_TS}@dealroom.video`;
const PARTY_B_EMAIL = `video-bob-${DEMO_TS}@dealroom.video`;
const DEAL_NAME = "Acme Corp × Widgets Inc — NDA";

// Output directory for screenshots (Remotion videos/public/)
const SCREENSHOTS_DIR = path.resolve(__dirname, "../../todolaw/videos/public");

// ─── Timing ─────────────────────────────────────────────────
const t0 = Date.now();
function log(msg: string) {
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[${elapsed}s] 📸 ${msg}`);
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

// ─── Screenshot helper ──────────────────────────────────────
async function capture(page: Page, name: string): Promise<void> {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, type: "png" });
  log(`Saved ${name}.png`);
}

// ─── Accept all compromise suggestions ──────────────────────
async function acceptAllSuggestions(page: Page, label: string): Promise<void> {
  const getAcceptBtns = () => page.locator("button.btn-brutal").filter({ hasText: /^Accept$|^\s*Accept\s*$/ });

  let count = await getAcceptBtns().count();
  if (count === 0) {
    await page.reload();
    await page.waitForTimeout(3_000);
    count = await getAcceptBtns().count();
  }

  log(`${label}: ${count} Accept buttons`);
  let clicks = 0;
  while (count > 0 && clicks < 30) {
    const btn = getAcceptBtns().first();
    try {
      await btn.click({ timeout: 5_000 });
      clicks++;
    } catch { /* retry */ }
    await page.waitForTimeout(2_500);
    count = await getAcceptBtns().count();
  }
  log(`${label}: ${clicks} accepted`);
}

// ─── THE CAPTURE RUN ────────────────────────────────────────

test.describe("Video Screenshot Capture", () => {
  test.setTimeout(900_000);

  test("Capture 6 key moments of NDA negotiation", async ({ page, browser }) => {
    // Use 1920×1080 viewport for video-quality screenshots
    await page.setViewportSize({ width: 1920, height: 1080 });

    // ── Login as Party A ──
    await loginAs(page, PARTY_A_EMAIL);
    await page.goto(`${BASE_URL}/deals`);
    await page.waitForTimeout(2_000);
    await setBusinessRole(page);
    await loginAs(page, PARTY_A_EMAIL);

    // ── ACT 1: Create deal ──
    await page.goto(`${BASE_URL}/deals/new`);
    await expect(page.locator("text=Loading contract types")).toBeHidden({ timeout: 10_000 });
    await dismissDialogs(page);
    await page.waitForTimeout(2_000);
    await dismissDialogs(page);
    await page.waitForTimeout(1_000);

    // 📸 SCREENSHOT 0: Contract type selection grid (intro background)
    await capture(page, "dealroom-dashboard");

    // Select NDA
    await page.locator("h3", { hasText: "Non-Disclosure Agreement" }).first().click();
    await page.waitForTimeout(1_000);

    // Select California
    const jurisdictionCard = page.locator("button").filter({
      has: page.locator("h3", { hasText: "California, USA" }),
    });
    await jurisdictionCard.first().click();
    await page.waitForTimeout(1_000);

    // Fill deal name
    const dealNameInput = page.locator("input#dealName");
    await expect(dealNameInput).toBeVisible({ timeout: 10_000 });
    await dealNameInput.click();
    await page.keyboard.type(DEAL_NAME, { delay: 50 });
    await page.waitForTimeout(500);

    // 📸 SCREENSHOT 1: Contract type selected, jurisdiction chosen, name filled
    await capture(page, "dealroom-select");

    // Continue to negotiation
    const continueBtn = page.locator("button", { hasText: /continue/i });
    await expect(continueBtn).toBeEnabled({ timeout: 10_000 });
    await continueBtn.click();
    await page.waitForURL("**/negotiate", { timeout: 15_000 });
    const dealUrl = page.url();
    const dealId = dealUrl.match(/\/deals\/([^/]+)\/negotiate/)![1];
    log(`Deal created: ${dealId}`);

    await dismissDialogs(page);
    await page.waitForTimeout(2_000);

    // ── ACT 2: Walk clauses ──
    const headerText = await page
      .locator("p", { hasText: /Clause \d+ of \d+/i })
      .first()
      .textContent();
    const clauseCount = parseInt(headerText!.match(/of (\d+)/)![1], 10);
    log(`${clauseCount} clauses`);

    // Dismiss any late-appearing dialogs (e.g. "Proceeding Without a Lawyer")
    await page.waitForTimeout(2_000);
    await dismissDialogs(page);
    await page.waitForTimeout(1_000);
    await dismissDialogs(page);
    await page.waitForTimeout(1_000);

    // 📸 SCREENSHOT 2: First clause with options visible (clause guidance view)
    await capture(page, "dealroom-clauses");

    // Walk through all clauses, selecting first option
    for (let i = 0; i < clauseCount; i++) {
      const isLast = i === clauseCount - 1;
      await dismissDialogs(page);

      const clauseTitle = page.locator("h2").first();
      await expect(clauseTitle).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(500);

      const optionCards = page.locator(".card-brutal.cursor-pointer");
      await expect(optionCards.first()).toBeVisible({ timeout: 10_000 });
      const radioCircle = optionCards.first().locator(".rounded-full.border-2").first();
      await radioCircle.click();
      await page.waitForTimeout(500);

      // 📸 SCREENSHOT 3: Mid-clause with option selected (priorities view)
      if (i === 2) {
        await capture(page, "dealroom-priorities");
      }

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
    await submitBtn.click();
    await page.waitForURL(/\/deals\/[^/]+(\/review)?$/, { timeout: 30_000 });
    log("Party A submitted");

    // ── ACT 3: Invite counterparty ──
    const inviteBtn = page.locator("button").filter({ hasText: /Invite Counterparty/i });
    await expect(inviteBtn).toBeVisible({ timeout: 10_000 });
    await inviteBtn.click();

    await expect(page.locator("[role=dialog]")).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(500);

    const emailInput = page.locator("[role=dialog] input[type=email]");
    await emailInput.click();
    await page.keyboard.type(PARTY_B_EMAIL, { delay: 30 });

    const nameInput = page.locator("[role=dialog] input").nth(1);
    await nameInput.click();
    await page.keyboard.type("Bob Williams", { delay: 30 });

    const companyInput = page.locator("[role=dialog] input").nth(2);
    await companyInput.click();
    await page.keyboard.type("Widgets Inc.", { delay: 30 });
    await page.waitForTimeout(500);

    // 📸 SCREENSHOT 4: Invite dialog filled out
    await capture(page, "dealroom-invite");

    const sendBtn = page.locator("[role=dialog] button").filter({ hasText: /Send Invitation/i });
    await sendBtn.click();
    await expect(page.locator("[role=dialog]")).toBeHidden({ timeout: 10_000 });
    log("Invitation sent");

    // ── ACT 4: Party B walks clauses ──
    const respCtx = await browser.newContext({
      baseURL: BASE_URL,
      viewport: { width: 1920, height: 1080 },
    });
    const respPage = await respCtx.newPage();
    await loginAs(respPage, PARTY_B_EMAIL);
    await respPage.goto(`${BASE_URL}/deals`);
    await respPage.waitForTimeout(2_000);
    await setBusinessRole(respPage);
    await loginAs(respPage, PARTY_B_EMAIL);

    await respPage.goto(`${BASE_URL}/deals/${dealId}/negotiate`);
    await respPage.waitForTimeout(3_000);
    await dismissDialogs(respPage);
    await respPage.waitForTimeout(1_000);

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
      await respPage.waitForTimeout(500);

      // Party B selects LAST option (disagree)
      const optionCards = respPage.locator(".card-brutal.cursor-pointer");
      await expect(optionCards.first()).toBeVisible({ timeout: 10_000 });
      const radioCircle = optionCards.last().locator(".rounded-full.border-2").first();
      await radioCircle.click();
      await respPage.waitForTimeout(500);

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
    await respSubmitBtn.click();
    await respPage.waitForURL(/\/deals\/[^/]+(\/review)?$/, { timeout: 30_000 });
    log("Party B submitted");

    // ── ACT 5: Compromise ──
    await page.goto(`${BASE_URL}/deals/${dealId}/review`);
    await page.waitForTimeout(3_000);

    const generateBtn = page.locator("button").filter({
      hasText: /Generate Compromise/i,
    });
    await expect(generateBtn).toBeVisible({ timeout: 10_000 });
    await generateBtn.click();
    log("Generating AI compromise...");

    await expect(generateBtn).toBeHidden({ timeout: 120_000 });
    log("Compromise generated");
    await page.waitForTimeout(3_000);

    // Wait for Accept buttons
    const acceptBtnLocator = page.locator("button.btn-brutal").filter({ hasText: /^Accept$|^\s*Accept\s*$/ });
    await expect(acceptBtnLocator.first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_000);

    // 📸 SCREENSHOT 5: Compromise suggestions with Accept buttons
    await capture(page, "dealroom-compromise");

    // Both parties accept
    await acceptAllSuggestions(page, "Party A");
    await respPage.goto(`${BASE_URL}/deals/${dealId}/review`);
    await respPage.waitForTimeout(3_000);
    await acceptAllSuggestions(respPage, "Party B");
    log("Both parties accepted");

    // ── ACT 6: Review (agreed state — this is our "lawyer" shot) ──
    await page.goto(`${BASE_URL}/deals/${dealId}/review`);
    await page.waitForTimeout(3_000);

    // 📸 SCREENSHOT 6: Agreed state / review page (used for "lawyer review" scene)
    await capture(page, "dealroom-lawyer");

    // ── ACT 7: Signing ──
    const proceedBtn = page.locator("button, a").filter({
      hasText: /Proceed to Signing/i,
    }).first();
    if (await proceedBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await proceedBtn.click();
      await page.waitForURL(`**/deals/${dealId}/sign`, { timeout: 15_000 });
      await page.waitForTimeout(3_000);
    }

    // Fill execution details
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
      await inputs.nth(0).fill("Acme Corporation");
      await page.waitForTimeout(300);
      await inputs.nth(1).fill("100 Market Street, San Francisco, CA 94105");
      await page.waitForTimeout(300);
      await inputs.nth(3).fill("Alice Johnson");
      await page.waitForTimeout(300);
      await inputs.nth(4).fill("Chief Executive Officer");
      await page.waitForTimeout(500);

      const confirmBtn = page.locator("button").filter({ hasText: /Confirm Details/i });
      await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
      await confirmBtn.click();
      await page.waitForTimeout(2_000);
    }

    // Type the signature name (but DON'T click Sign yet — capture mid-signature)
    const sigInput = page.locator("input.input-brutal.text-lg");
    if (await sigInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await sigInput.click();
      await page.keyboard.type("Alice Johnson", { delay: 80 });
      await page.waitForTimeout(500);
      await page.locator("input[type=checkbox]").check();
      await page.waitForTimeout(500);

      // 📸 SCREENSHOT 7: Signing page with typed signature, ready to sign
      await capture(page, "dealroom-signing");
    }

    await respCtx.close();
    log("CAPTURE COMPLETE — 6 screenshots saved to videos/public/");
  });
});
