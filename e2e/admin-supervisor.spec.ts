import { test, expect } from "@playwright/test";

test.describe("Portal Smoke Tests", () => {
  test("admin sign-in page loads with email input", async ({ page }) => {
    await page.goto("/admin/sign-in");

    // Should show Platform Admin heading
    await expect(page.locator("h1", { hasText: "Platform Admin" })).toBeVisible();

    // Should have an email input
    const emailInput = page.locator("input#email");
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute("type", "email");

    // Should have the submit button
    await expect(page.locator("button", { hasText: "Continue with Email" })).toBeVisible();

    // Should show the "no password needed" text
    await expect(page.locator("text=No password needed")).toBeVisible();
  });

  test("supervisor sign-in page loads with email input", async ({ page }) => {
    await page.goto("/supervise/sign-in");

    // Should show Supervisor Portal heading
    await expect(page.locator("h1", { hasText: "Supervisor Portal" })).toBeVisible();

    // Should have an email input
    const emailInput = page.locator("input#email");
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute("type", "email");

    // Should have the submit button
    await expect(page.locator("button", { hasText: "Continue with Email" })).toBeVisible();

    // Should show the "no password needed" text
    await expect(page.locator("text=No password needed")).toBeVisible();
  });
});
