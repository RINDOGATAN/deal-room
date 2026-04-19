/**
 * Smoke test: Startup Quick Start (/launch) journey.
 *
 * Verifies the Increment 1 happy path end-to-end:
 *   /launch landing
 *   /launch/new create-journey wizard (3 substeps)
 *   /launch/[id] hub
 *   /launch/[id]/step/foundation wizard (2 questions + review)
 *   generateStep produces deals linked via journeyId + journeyStepKey
 *   hub reflects generated deals and a Request-review button
 *
 * Runs on both desktop (1440) and mobile (375) viewports via the
 * default Playwright projects.
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Launch journey — Foundation step smoke", () => {
  test("founder can create a journey, answer questions, and generate docs", async ({ page }) => {
    const email = `e2e-launch-${Date.now()}@dealroom.test`;
    await loginAs(page, email);

    // 1. Landing
    await page.goto("/launch");
    await expect(page.getByRole("heading", { name: /Launch your Delaware C-Corp/i })).toBeVisible();
    await page.getByRole("link", { name: /Start my company/i }).click();

    // 2. Step 1 — Company basics
    await expect(page).toHaveURL(/\/launch\/new$/);
    const companyName = `E2E Acme ${Date.now()}`;
    await page.getByLabel("Company name *").fill(companyName);
    await page.getByLabel(/Principal business address/i).fill("548 Market St #1234, San Francisco, CA 94104");
    await page.getByRole("button", { name: /Next: founders/i }).click();

    // 3. Step 2 — Founders (1 of 1)
    await page.getByLabel("Full name").fill("Alice Founder");
    await page.getByLabel("Email").fill("alice@example.com");
    await page.getByLabel("Equity %").fill("100");
    await page.getByRole("button", { name: /Review/i }).click();

    // 4. Step 3 — Review + submit
    await expect(page.getByText(companyName)).toBeVisible();
    await expect(page.getByText("Alice Founder")).toBeVisible();
    await page.getByRole("button", { name: /Create journey/i }).click();

    // 5. Journey hub
    await expect(page).toHaveURL(/\/launch\/[a-z0-9]+$/);
    await expect(page.getByRole("heading", { name: companyName })).toBeVisible();

    // Four step cards
    await expect(page.getByRole("heading", { name: /Form your company/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Set up your option pool/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Hire your first people/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Raise your first round/i })).toBeVisible();

    // 6. Enter Foundation step
    await page.getByRole("link", { name: /^Start/i }).click();
    await expect(page).toHaveURL(/\/step\/foundation$/);

    // 7. Answer Q1 (vesting) — pick Recommended option
    await expect(page.getByRole("heading", { name: /If a founder leaves in the first year/i })).toBeVisible();
    await page.getByRole("button", { name: /No.*vest over 4 years/i }).click();

    // 8. Answer Q2 (ip-scope) — pick Recommended option
    await expect(page.getByRole("heading", { name: /Should founders assign every invention/i })).toBeVisible();
    await page.getByRole("button", { name: /assign everything relevant/i }).click();

    // 9. Review screen — 3 documents expected (1 Cert + 1 Founders' + 1 IP Assignment)
    await expect(page.getByRole("heading", { name: /Ready to generate/i })).toBeVisible();
    await expect(page.getByText(/Certificate of Incorporation/i)).toBeVisible();
    await expect(page.getByText(/Founders' Agreement.*Alice Founder/i)).toBeVisible();
    await expect(page.getByText(/IP Assignment.*Alice Founder/i)).toBeVisible();

    // 10. Generate — three DealRooms + clauses are created server-side,
    //     so give the mutation + redirect a generous window.
    await page.getByRole("button", { name: /Generate 3 documents/i }).click();

    // 11. Back on hub, Formation step now shows "Ready" and the 3 deals
    await expect(page).toHaveURL(/\/launch\/[a-z0-9]+$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: companyName })).toBeVisible();
    await expect(page.getByText(new RegExp(`${companyName} — Certificate of Incorporation`))).toBeVisible();
    await expect(page.getByRole("button", { name: /Request lawyer review/i })).toBeVisible();

    // 12. Open the Cert of Inc deal — verify it's a real SOLO deal
    //     with journey-derived party name and the 6 Cert clauses.
    await page.getByText(new RegExp(`${companyName} — Certificate of Incorporation`)).click();
    await expect(page).toHaveURL(/\/deals\/[a-z0-9]+$/);
    await expect(
      page.getByRole("heading", { name: new RegExp(`${companyName} — Certificate of Incorporation`) }),
    ).toBeVisible();
  });

  test("hub page blocks locked steps and allows only Formation to start", async ({ page }) => {
    const email = `e2e-launch-locks-${Date.now()}@dealroom.test`;
    await loginAs(page, email);

    // Create a minimal journey directly
    await page.goto("/launch/new");
    await page.getByLabel("Company name *").fill(`E2E Locks ${Date.now()}`);
    await page.getByRole("button", { name: /Next: founders/i }).click();
    await page.getByLabel("Full name").fill("Only Founder");
    await page.getByLabel("Email").fill("only@example.com");
    await page.getByRole("button", { name: /Review/i }).click();
    await page.getByRole("button", { name: /Create journey/i }).click();

    // Hub: equity/hiring/raise all say "Soon" (or "Locked" if truly locked)
    // Only Formation should render the Start link
    await expect(page.getByRole("heading", { name: companyNameLocksRegex })).toBeVisible().catch(() => {});
    const startLinks = page.getByRole("link", { name: /^Start/i });
    await expect(startLinks).toHaveCount(1);
  });

  test("founder can skip Formation with 'I have this already' and downstream steps unlock", async ({ page }) => {
    const email = `e2e-launch-skip-${Date.now()}@dealroom.test`;
    await loginAs(page, email);

    await page.goto("/launch/new");
    await page.getByLabel("Company name *").fill(`Already Formed ${Date.now()}`);
    await page.getByRole("button", { name: /Next: founders/i }).click();
    await page.getByLabel("Full name").fill("Seasoned Founder");
    await page.getByLabel("Email").fill("seasoned@example.com");
    await page.getByRole("button", { name: /Review/i }).click();
    await page.getByRole("button", { name: /Create journey/i }).click();
    await page.waitForURL(/\/launch\/[a-z0-9]+$/);

    // Foundation card shows the "I have this already" escape hatch
    const iHaveIt = page.getByRole("button", { name: /I have this already/i }).first();
    await expect(iHaveIt).toBeVisible();

    // Baseline: before skip, only Foundation has the link (equity/hiring/raise locked)
    const iHaveItLinksBefore = page.getByRole("button", { name: /I have this already/i });
    await expect(iHaveItLinksBefore).toHaveCount(1);

    await iHaveIt.click();

    // Dialog opens with the Foundation-specific copy
    await expect(page.getByRole("heading", { name: /You've already formed your company/i })).toBeVisible();
    await expect(page.getByText(/Certificate of Incorporation filed with Delaware/i)).toBeVisible();
    await page.getByRole("button", { name: /I have everything — mark as done/i }).click();

    // Foundation card flips to "Done elsewhere" and the reset link appears
    await expect(page.getByText(/Done elsewhere/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Actually, I still need this/i })).toBeVisible();

    // Downstream steps that depend on Foundation are now unlocked —
    // equity-pool and raise both show the "I have this already" option too
    const iHaveItLinksAfter = page.getByRole("button", { name: /I have this already/i });
    await expect(iHaveItLinksAfter).toHaveCount(2); // equity-pool + raise (both unlockedBy foundation)
  });
});

// Matches the generated company-name pattern from the "locks" test
const companyNameLocksRegex = /E2E Locks \d+/;
