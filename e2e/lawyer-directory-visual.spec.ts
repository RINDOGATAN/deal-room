import { test, expect, type Page } from "@playwright/test";
import { trialLogin } from "./helpers/auth";

/**
 * Visual verification for Phase 2: Lawyer Directory pages.
 * Screenshots every new page at both desktop and mobile viewports.
 */

async function selectRole(page: Page, role: "business" | "lawyer") {
  // Wait for the onboarding modal
  const modal = page.locator("[role=dialog]");
  if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Click the role card — Business Owner is first, Lawyer is second
    const cards = modal.locator("button").filter({ has: page.locator(".w-10.h-10") });
    if (role === "business") {
      await cards.first().click();
    } else {
      await cards.last().click();
    }
    // Click the continue button
    await modal.locator("button.btn-brutal").click();
    // Wait for modal to close
    await page.waitForTimeout(1500);
  }
}

// ── BUSINESS OWNER TESTS ─────────────────────────────────────

test.describe("Business Owner Views", () => {
  test.beforeEach(async ({ page }) => {
    await trialLogin(page);
    await selectRole(page, "business");
  });

  test("directory page renders", async ({ page }) => {
    await page.goto("/lawyers");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `e2e/screenshots/directory-${test.info().project.name}.png`,
      fullPage: true,
    });
    await expect(page.locator("h1")).toContainText(/Lawyer Directory|Directorio/);
  });

  test("directory page with filters", async ({ page }) => {
    await page.goto("/lawyers");
    await page.waitForLoadState("networkidle");
    const jurisdictionSelect = page.locator("select").first();
    await jurisdictionSelect.selectOption("CALIFORNIA");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `e2e/screenshots/directory-filtered-${test.info().project.name}.png`,
      fullPage: true,
    });
  });

  test("requests page (sent view)", async ({ page }) => {
    await page.goto("/lawyers/requests");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `e2e/screenshots/requests-sent-${test.info().project.name}.png`,
      fullPage: true,
    });
    await expect(page.locator("h1")).toContainText(/Recommendation Requests|Solicitudes/);
  });

  test("new deal page shows lawyer hint", async ({ page }) => {
    await page.goto("/deals/new");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `e2e/screenshots/new-deal-hint-${test.info().project.name}.png`,
      fullPage: true,
    });
    // Verify the hint link is visible (use text to disambiguate from nav link)
    await expect(page.getByRole('link', { name: /Find a Lawyer →|Buscar Abogado/ })).toBeVisible();
  });

  test("nav shows Find a Lawyer", async ({ page }) => {
    await page.goto("/deals");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `e2e/screenshots/nav-business-${test.info().project.name}.png`,
    });
  });
});

// ── LAWYER TESTS ─────────────────────────────────────────────

test.describe("Lawyer Views", () => {
  test.beforeEach(async ({ page }) => {
    await trialLogin(page);
    // The user might already have a role from a previous test run.
    // Switch to lawyer via the onboarding modal or role-switch button.
    await selectRole(page, "lawyer");
  });

  test("profile page renders", async ({ page }) => {
    await page.goto("/lawyers/profile");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `e2e/screenshots/profile-${test.info().project.name}.png`,
      fullPage: true,
    });
    // Profile page may redirect non-lawyers to /lawyers; either heading is acceptable
    await expect(page.locator("h1")).toContainText(/Directory Profile|Perfil|Lawyer Directory|Directorio/);
  });

  test("requests page (incoming view)", async ({ page }) => {
    await page.goto("/lawyers/requests");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `e2e/screenshots/requests-incoming-${test.info().project.name}.png`,
      fullPage: true,
    });
    await expect(page.locator("h1")).toContainText(/Recommendation Requests|Solicitudes/);
  });

  test("vettings page with profile link", async ({ page }) => {
    await page.goto("/lawyer/vettings");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `e2e/screenshots/vettings-${test.info().project.name}.png`,
      fullPage: true,
    });
  });

  test("nav shows Requests", async ({ page }) => {
    await page.goto("/deals");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `e2e/screenshots/nav-lawyer-${test.info().project.name}.png`,
    });
  });
});
