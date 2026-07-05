import { test, expect } from "@playwright/test";
import { trialLogin } from "./helpers/auth";
import { createDealWithOptions } from "./helpers/deal";

const TIMESTAMP = Date.now();

/**
 * Skip if not on mobile viewport.
 */
function skipIfDesktop(page: import("@playwright/test").Page) {
  const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
  if (!isMobile) {
    test.skip(true, "Mobile-only test");
  }
}

test.describe("Mobile Interactions", () => {
  // ──────────────────────────────────────────────────────────
  // Hamburger menu
  // ──────────────────────────────────────────────────────────
  test("hamburger opens and closes", async ({ page }) => {
    skipIfDesktop(page);
    test.setTimeout(30_000);

    await trialLogin(page);

    // Open hamburger
    const menuButton = page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-menu") });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    // Overlay nav should appear
    const navOverlay = page.locator("nav.fixed, .fixed.inset-0").filter({
      has: page.locator("a[href='/deals']"),
    });
    await expect(navOverlay).toBeVisible({ timeout: 5_000 });

    // Close via X button
    const closeButton = page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-x") });
    await closeButton.click();
    await expect(navOverlay).toBeHidden({ timeout: 5_000 });
  });

  test("hamburger has all nav items", async ({ page }) => {
    skipIfDesktop(page);
    test.setTimeout(30_000);

    await trialLogin(page);

    // Open hamburger
    await page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-menu") })
      .click();

    // Check essential nav items
    await expect(
      page.locator("a[href='/deals']").last(),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator("a[href='/deals/new']").last(),
    ).toBeVisible();

    // Sign out button
    await expect(
      page.locator("button", { hasText: /sign out|cerrar sesi/i }).last(),
    ).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────
  // FAB & clause sidebar
  // ──────────────────────────────────────────────────────────
  test("FAB opens clause sidebar", async ({ page }) => {
    skipIfDesktop(page);
    test.setTimeout(60_000);

    await trialLogin(page);

    await createDealWithOptions(page, {
      contractType: "Data Processing Agreement",
      jurisdiction: "California, USA",
      language: "English",
      dealName: `Mobile FAB ${TIMESTAMP}`,
    });

    // FAB should be visible
    const fab = page
      .locator("button.fixed")
      .filter({ has: page.locator("svg.lucide-list") });
    await expect(fab).toBeVisible({ timeout: 10_000 });

    // Click FAB to open sidebar overlay
    await fab.click();

    // Overlay should be visible with clause list
    const overlay = page.locator(".fixed.inset-0").filter({
      hasText: /Clauses|Cláusulas/i,
    });
    await expect(overlay).toBeVisible({ timeout: 5_000 });
  });

  test("clause nav via sidebar", async ({ page }) => {
    skipIfDesktop(page);
    test.setTimeout(60_000);

    await trialLogin(page);

    await createDealWithOptions(page, {
      contractType: "Data Processing Agreement",
      jurisdiction: "California, USA",
      language: "English",
      dealName: `Mobile ClauseNav ${TIMESTAMP}`,
    });

    const initialTitle = await page.locator("h2").first().textContent();

    // Open sidebar
    const fab = page
      .locator("button.fixed")
      .filter({ has: page.locator("svg.lucide-list") });
    await fab.click();

    // Click the 2nd clause in the sidebar list
    const clauseButtons = page
      .locator(".fixed.inset-0 button")
      .filter({ has: page.locator(".rounded-full") });
    await expect(clauseButtons.nth(1)).toBeVisible({ timeout: 5_000 });
    await clauseButtons.nth(1).click();

    // Title should change
    await expect(page.locator("h2").first()).not.toHaveText(initialTitle!, {
      timeout: 10_000,
    });
  });

  // ──────────────────────────────────────────────────────────
  // Horizontal overflow checks
  // ──────────────────────────────────────────────────────────
  test("no horizontal overflow: static pages", async ({ page }) => {
    skipIfDesktop(page);
    test.setTimeout(30_000);

    await trialLogin(page);

    for (const route of ["/deals", "/deals/new"]) {
      await page.goto(route, { waitUntil: "networkidle" });

      const hasOverflow = await page.evaluate(() => {
        const body = document.documentElement;
        return body.scrollWidth > body.clientWidth;
      });

      expect(
        hasOverflow,
        `Horizontal overflow detected on ${route}`,
      ).toBe(false);
    }
  });

  test("no horizontal overflow: negotiate page", async ({ page }) => {
    skipIfDesktop(page);
    test.setTimeout(60_000);

    await trialLogin(page);

    await createDealWithOptions(page, {
      contractType: "Data Processing Agreement",
      jurisdiction: "California, USA",
      language: "English",
      dealName: `Mobile Overflow ${TIMESTAMP}`,
    });

    // Select an option to trigger layout change
    const optionCards = page.locator(".card-brutal.cursor-pointer");
    await expect(optionCards.first()).toBeVisible({ timeout: 10_000 });
    await optionCards.first().click();

    // Check for overflow after selection
    const hasOverflow = await page.evaluate(() => {
      const body = document.documentElement;
      return body.scrollWidth > body.clientWidth;
    });

    expect(
      hasOverflow,
      "Horizontal overflow detected on negotiate page after option selection",
    ).toBe(false);
  });

  // ──────────────────────────────────────────────────────────
  // Parameter form on mobile
  // ──────────────────────────────────────────────────────────
  test("parameter form: Seed Investment params visible and fillable", async ({
    page,
  }) => {
    skipIfDesktop(page);
    test.setTimeout(60_000);

    await trialLogin(page);
    await page.goto("/deals/new");
    await expect(
      page.locator("text=Loading contract types"),
    ).toBeHidden({ timeout: 10_000 });

    // Select Seed Investment
    await page
      .locator("h3", { hasText: "Seed Investment Agreement" })
      .first()
      .click();

    // Select jurisdiction
    await page.locator("text=California, USA").click();

    // English is auto-selected — check deal name + params are visible
    const dealNameInput = page.locator("input#dealName");
    await expect(dealNameInput).toBeVisible();

    // Required params should be visible
    const params = [
      "pre-money-valuation",
      "investment-amount",
      "share-count",
      "share-price",
      "board-size",
    ];

    for (const paramId of params) {
      const input = page.locator(`#param-${paramId}`);
      await expect(input).toBeVisible({ timeout: 5_000 });
    }

    // Fill and verify values persist
    await page.locator("#param-pre-money-valuation").fill("2000000");
    await page.locator("#param-investment-amount").fill("500000");
    await page.locator("#param-share-count").fill("500000");
    await page.locator("#param-share-price").fill("1");
    await page.locator("#param-board-size").fill("3");

    // Values should persist (not cleared by React re-render)
    await expect(page.locator("#param-pre-money-valuation")).toHaveValue(
      "2000000",
    );
    await expect(page.locator("#param-board-size")).toHaveValue("3");
  });
});
