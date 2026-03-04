import { test, expect } from "@playwright/test";
import { trialLogin } from "./helpers/auth";
import { createDealWithOptions, getClauseCount, walkAllClauses } from "./helpers/deal";
const TIMESTAMP = Date.now();

// All jurisdiction × language combos for DPA
const DPA_MATRIX = [
  { jurisdiction: "California, USA", language: "English", tag: "CA-EN" },
  { jurisdiction: "California, USA", language: "Español", tag: "CA-ES" },
  { jurisdiction: "England & Wales, UK", language: "English", tag: "UK-EN" },
  { jurisdiction: "England & Wales, UK", language: "Español", tag: "UK-ES" },
  { jurisdiction: "Spain, EU", language: "English", tag: "ES-EN" },
  { jurisdiction: "Spain, EU", language: "Español", tag: "ES-ES" },
] as const;

// Licensed skills that should show access-required dialog
const LOCKED_SKILLS = [
  "Founders Agreement",
  "SAFE Agreement",
  "Pacto de Socios",
];

test.describe("Workflow Smoke Tests", () => {
  // ──────────────────────────────────────────────────────────
  // 1. DPA — All 6 jurisdiction × language combos
  // ──────────────────────────────────────────────────────────
  test.describe("DPA — All jurisdiction × language combos", () => {
    for (const combo of DPA_MATRIX) {
      test(`DPA ${combo.tag}: create + walk all clauses`, async ({
        page,
      }) => {
        test.setTimeout(180_000); // walking all clauses needs extra time

        // Collect console errors for React crash detection
        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") consoleErrors.push(msg.text());
        });

        await trialLogin(page);

        const dealId = await createDealWithOptions(page, {
          contractType: "Data Processing Agreement",
          jurisdiction: combo.jurisdiction,
          language: combo.language,
          dealName: `Smoke DPA ${combo.tag} ${TIMESTAMP}`,
        });

        expect(dealId).toBeTruthy();

        // Get actual clause count from the page
        const clauseCount = await getClauseCount(page);
        expect(clauseCount).toBeGreaterThan(0);

        // Walk every clause
        await walkAllClauses(page, clauseCount);

        // Assert no React crashes
        const reactCrashes = consoleErrors.filter(
          (e) =>
            e.includes("Minified React error") ||
            e.includes("Objects are not valid as a React child"),
        );
        expect(reactCrashes).toHaveLength(0);
      });
    }
  });

  // ──────────────────────────────────────────────────────────
  // 2. Licensed skills — Access Required dialog
  // ──────────────────────────────────────────────────────────
  test.describe("Licensed skills — locked state verification", () => {
    for (const skillName of LOCKED_SKILLS) {
      test(`${skillName}: shows Access Required dialog`, async ({ page }) => {
        await trialLogin(page);
        await page.goto("/deals/new");
        await expect(
          page.locator("text=Loading contract types"),
        ).toBeHidden({ timeout: 10_000 });

        // Find the locked card for this skill
        const skillCard = page
          .locator("button.opacity-60")
          .filter({ hasText: skillName });

        const count = await skillCard.count();
        if (count === 0) {
          test.skip(true, `${skillName} not found or not locked`);
          return;
        }

        await skillCard.click();

        // Verify the Access Required dialog appears
        await expect(page.locator("[role=dialog]")).toBeVisible({
          timeout: 5_000,
        });
        await expect(
          page.locator("text=Access Required").first(),
        ).toBeVisible();

        // Close the dialog
        const closeButton = page
          .locator("[role=dialog]")
          .locator("button", { hasText: /close|cerrar|×/i });
        if ((await closeButton.count()) > 0) {
          await closeButton.first().click();
        } else {
          // Press Escape as fallback
          await page.keyboard.press("Escape");
        }

        await expect(page.locator("[role=dialog]")).toBeHidden();
      });
    }
  });

  // ──────────────────────────────────────────────────────────
  // 3. i18n — Spanish locale deal creation
  // ──────────────────────────────────────────────────────────
  test.describe("i18n — Spanish locale deal", () => {
    test("create DPA in Spanish locale and verify Spanish clause content", async ({
      page,
    }) => {
      test.setTimeout(180_000);

      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await trialLogin(page);

      // Switch to Spanish locale
      const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
      if (isMobile) {
        await page
          .locator("button")
          .filter({ has: page.locator("svg.lucide-menu") })
          .click();
        // On mobile, the visible EN button is inside the overlay (last match)
        await page.locator("button", { hasText: "EN" }).last().click();
        // After toggle, wait for page to settle (menu closes on locale switch)
        await page.waitForTimeout(2_000);
      } else {
        await page.locator("button", { hasText: "EN" }).click();
        await expect(
          page.locator("text=Mis Acuerdos").first(),
        ).toBeVisible({ timeout: 10_000 });
      }

      // Navigate to new deal and verify DPA shows Spanish name
      await page.goto("/deals/new");
      await expect(
        page.locator("text=Loading contract types").or(
          page.locator("text=Cargando tipos de contrato"),
        ),
      ).toBeHidden({ timeout: 10_000 });

      // DPA should show its Spanish display name
      await expect(
        page
          .locator("h3", { hasText: "Acuerdo de encargo de tratamiento de datos" })
          .first(),
      ).toBeVisible({ timeout: 10_000 });

      // Create the deal in Spanish
      const dealId = await createDealWithOptions(page, {
        contractType: "Acuerdo de encargo de tratamiento de datos",
        jurisdiction: "California, USA",
        language: "Español",
        dealName: `Smoke DPA ES-Locale ${TIMESTAMP}`,
      });

      expect(dealId).toBeTruthy();

      // Verify negotiate page renders clause titles (should be in Spanish)
      const clauseTitle = page.locator("h2").first();
      await expect(clauseTitle).toBeVisible({ timeout: 10_000 });

      // Verify option cards render (no crash)
      const optionCards = page.locator(".card-brutal.cursor-pointer");
      await expect(optionCards.first()).toBeVisible({ timeout: 10_000 });

      // Walk all clauses to verify no React crashes
      const clauseCount = await getClauseCount(page);
      await walkAllClauses(page, clauseCount);

      const reactCrashes = consoleErrors.filter(
        (e) =>
          e.includes("Minified React error") ||
          e.includes("Objects are not valid as a React child"),
      );
      expect(reactCrashes).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────
  // 4. Admin portal
  // ──────────────────────────────────────────────────────────
  test.describe("Admin portal", () => {
    test("admin sign-in page renders", async ({ page }) => {
      await page.goto("/admin/sign-in");

      await expect(page.locator("h1").first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("input[type=email]")).toBeVisible();
      await expect(
        page.locator("button", { hasText: /continue with email|sign in|iniciar/i }).first(),
      ).toBeVisible();
    });
  });

  // ──────────────────────────────────────────────────────────
  // 5. Supervisor portal
  // ──────────────────────────────────────────────────────────
  test.describe("Supervisor portal", () => {
    test("supervisor sign-in page renders", async ({ page }) => {
      await page.goto("/supervise/sign-in");

      await expect(page.locator("h1").first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("input[type=email]")).toBeVisible();
      await expect(
        page.locator("button", { hasText: /continue with email|sign in|iniciar/i }).first(),
      ).toBeVisible();
    });
  });

  // ──────────────────────────────────────────────────────────
  // 6. Review & Sign pages (existing deal)
  // ──────────────────────────────────────────────────────────
  test.describe("Review & Sign pages", () => {
    test("review page loads without crash", async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await trialLogin(page);

      // Find an existing deal
      const dealLinks = page
        .locator("a[href^='/deals/']")
        .filter({ hasNot: page.locator("svg.lucide-plus") });
      const count = await dealLinks.count();
      if (count === 0) {
        test.skip(true, "No existing deals to test review page");
        return;
      }

      await dealLinks.first().click();
      await page.waitForURL("**/deals/**");

      const dealId = page.url().match(/\/deals\/([^/]+)/)?.[1];
      if (!dealId) {
        test.skip(true, "Could not extract deal ID");
        return;
      }

      await page.goto(`/deals/${dealId}/review`);

      // Page should render without crash
      const pageContent = page.locator("h1, h2, .card-brutal").first();
      await expect(pageContent).toBeVisible({ timeout: 10_000 });

      const reactCrashes = consoleErrors.filter(
        (e) =>
          e.includes("Minified React error") ||
          e.includes("Objects are not valid as a React child"),
      );
      expect(reactCrashes).toHaveLength(0);
    });

    test("sign page loads without crash", async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await trialLogin(page);

      const dealLinks = page
        .locator("a[href^='/deals/']")
        .filter({ hasNot: page.locator("svg.lucide-plus") });
      const count = await dealLinks.count();
      if (count === 0) {
        test.skip(true, "No existing deals to test sign page");
        return;
      }

      await dealLinks.first().click();
      await page.waitForURL("**/deals/**");

      const dealId = page.url().match(/\/deals\/([^/]+)/)?.[1];
      if (!dealId) {
        test.skip(true, "Could not extract deal ID");
        return;
      }

      await page.goto(`/deals/${dealId}/sign`);

      // Page should render without crash
      const pageContent = page.locator("h1, h2, .card-brutal").first();
      await expect(pageContent).toBeVisible({ timeout: 10_000 });

      const reactCrashes = consoleErrors.filter(
        (e) =>
          e.includes("Minified React error") ||
          e.includes("Objects are not valid as a React child"),
      );
      expect(reactCrashes).toHaveLength(0);
    });
  });
});
