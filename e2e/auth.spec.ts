import { test, expect } from "@playwright/test";
import { trialLogin } from "./helpers/auth";

test.describe("Authentication", () => {
  test("trial sign-in redirects to /deals", async ({ page }) => {
    await trialLogin(page);
    await expect(page).toHaveURL(/\/deals/);
  });

  test("session persists across page reload", async ({ page }) => {
    await trialLogin(page);
    await page.reload();
    await expect(page).toHaveURL(/\/deals/);
    // Dashboard heading should be visible after reload
    await expect(page.locator("text=My Deals").first()).toBeVisible({ timeout: 10_000 });
  });

  test("sign-out redirects to /sign-in", async ({ page }) => {
    await trialLogin(page);

    // Wait for dashboard to fully render
    await expect(page.locator("text=My Deals").first()).toBeVisible({ timeout: 10_000 });

    // On mobile the sign-out is behind the hamburger menu
    const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
    if (isMobile) {
      await page.locator("button").filter({ has: page.locator("svg.lucide-menu") }).click();
    }

    const signOutButton = page.locator("button", { hasText: /sign out|cerrar sesión/i });
    await expect(signOutButton.first()).toBeVisible({ timeout: 10_000 });
    await signOutButton.first().click();
    await page.waitForURL("**/sign-in", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("unauthenticated user is redirected to /sign-in", async ({ page }) => {
    await page.goto("/deals");
    await page.waitForURL("**/sign-in", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("admin sign-in page renders", async ({ page }) => {
    await page.goto("/admin/sign-in");
    await expect(page.locator("h1", { hasText: "Platform Admin" })).toBeVisible();
    await expect(page.locator("input#email")).toBeVisible();
    await expect(page.locator("button", { hasText: "Continue with Email" })).toBeVisible();
  });

  test("supervisor sign-in page renders", async ({ page }) => {
    await page.goto("/supervise/sign-in");
    await expect(page.locator("h1", { hasText: "Supervisor Portal" })).toBeVisible();
    await expect(page.locator("input#email")).toBeVisible();
    await expect(page.locator("button", { hasText: "Continue with Email" })).toBeVisible();
  });
});
