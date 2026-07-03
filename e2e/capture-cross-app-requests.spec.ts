/**
 * Capture Screenshots for Cross-App Assistance Request Video
 * ===========================================================
 * Walks through the full workflow: external app sends a request via API →
 * expert sees it in her inbox with source badge → accepts.
 *
 * Output: PNG files in ../todolaw/videos/public/ (prefixed "crossapp-")
 *
 * HOW TO RUN:
 *   E2E_CREDENTIALS_SECRET="e2e-test-secret" \
 *     npx playwright test e2e/capture-cross-app-requests.spec.ts \
 *     --project=desktop --retries=0
 *
 * PREREQUISITES:
 *   - A published LawyerProfile for the lawyer user (acceptingClients: true)
 *   - An API key with `experts:contact` scope (the script creates the request via API)
 *   - The lawyer must have at least one incoming request with sourceApp set
 *
 * The spec creates the cross-app request via the API, then captures the
 * lawyer's perspective through the UI.
 */

import { test, expect, type Page } from "@playwright/test";
import path from "path";

// ─── Configuration ──────────────────────────────────────────
const BASE_URL = process.env.E2E_BASE_URL || "https://dealroom.todo.law";
const E2E_SECRET = process.env.E2E_CREDENTIALS_SECRET || "e2e-test-secret";
const API_KEY = process.env.E2E_API_KEY || ""; // drk_... key with experts:contact scope
const DEMO_TS = Date.now();

const LAWYER_EMAIL = `video-lawyer-${DEMO_TS}@dealroom.video`;
const REQUESTER_EMAIL = `video-requester-${DEMO_TS}@dpocentral.video`;
const REQUESTER_NAME = "María García";

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

async function setLawyerRole(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const res = await fetch("/api/trpc/lawyer.setRole?batch=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "0": { json: { role: "LAWYER" } } }),
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

// ─── THE CAPTURE RUN ────────────────────────────────────────

test.describe("Cross-App Assistance Request Screenshots", () => {
  test.setTimeout(300_000);

  test("Capture 6 key moments of cross-app request workflow", async ({ page }) => {
    // Use 1920×1080 viewport for video-quality screenshots
    await page.setViewportSize({ width: 1920, height: 1080 });

    // ── Step 0: Login as lawyer, set role, ensure profile ──
    await loginAs(page, LAWYER_EMAIL);
    await page.goto(`${BASE_URL}/deals`);
    await page.waitForTimeout(2_000);
    await setLawyerRole(page);
    await loginAs(page, LAWYER_EMAIL);

    // ── ACT 2: Show the API key management in admin ──
    // Navigate to admin customers page (if accessible) or show the request already created
    // Instead, we'll go straight to the lawyer inbox since the API call is shown as a code snippet in the video

    // ── ACT 3: Create request via API (programmatic — the external app's perspective) ──
    if (API_KEY) {
      // Use the Experts API to find the lawyer and submit a request
      const searchRes = await page.request.post(`${BASE_URL}/api/v1/experts/search`, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        data: { query: "", limit: 1 },
      });
      const searchData = await searchRes.json();
      const lawyerId = searchData?.results?.[0]?.id;

      if (lawyerId) {
        const reqRes = await page.request.post(
          `${BASE_URL}/api/v1/experts/${lawyerId}/contact`,
          {
            headers: {
              Authorization: `Bearer ${API_KEY}`,
              "Content-Type": "application/json",
            },
            data: {
              subject: "Data Processing Agreement",
              governingLaw: "SPAIN",
              message: "We need help reviewing our processor agreement for GDPR compliance. Our DPO flagged several issues in the sub-processor clauses.",
              requesterEmail: REQUESTER_EMAIL,
              requesterName: REQUESTER_NAME,
            },
          },
        );
        log(`API request created: ${reqRes.status()}`);
      }
    } else {
      log("No E2E_API_KEY set — skipping API request creation (use pre-seeded data)");
    }

    // ── ACT 4: Lawyer opens her profile page ──
    await page.goto(`${BASE_URL}/lawyers/profile`);
    await page.waitForTimeout(3_000);
    await dismissDialogs(page);
    await page.waitForTimeout(1_000);

    // 📸 SCREENSHOT 1: Lawyer's published profile (she's the expert receiving requests)
    await capture(page, "crossapp-profile");

    // ── ACT 5: Lawyer opens inbox — sees cross-app request with source badge ──
    await page.goto(`${BASE_URL}/lawyers/requests`);
    await page.waitForTimeout(3_000);
    await dismissDialogs(page);
    await page.waitForTimeout(1_000);

    // 📸 SCREENSHOT 2: Inbox with cross-app request showing "DPO Central" source badge
    await capture(page, "crossapp-inbox");

    // ── ACT 6: Lawyer accepts the request ──
    const acceptBtn = page.locator("button.btn-brutal").filter({ hasText: /^Accept$/ });
    if (await acceptBtn.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
      // 📸 SCREENSHOT 3: Request card expanded with Accept/Decline buttons visible
      await capture(page, "crossapp-accept");

      await acceptBtn.first().click();
      await page.waitForTimeout(2_000);
    } else {
      log("No Accept button visible — request may already be accepted or not seeded");
      // Still capture the current state
      await capture(page, "crossapp-accept");
    }

    // ── ACT 7: Capture the accepted state (the vetting flow was removed with
    // the lawyer-expert directory; the expert now follows up by email) ──
    await page.waitForTimeout(1_000);
    // 📸 SCREENSHOT 4: Accepted request state
    await capture(page, "crossapp-accepted");

    log("CAPTURE COMPLETE — screenshots saved to videos/public/");
  });
});
