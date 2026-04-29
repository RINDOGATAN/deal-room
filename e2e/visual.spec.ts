import { test, expect } from "@playwright/test";
import { trialLogin } from "./helpers/auth";

test.describe("Design System Verification", () => {
  test.beforeEach(async ({ page }) => {
    await trialLogin(page);
  });

  test("cards have rounded corners (border-radius > 0)", async ({ page }) => {
    const card = page.locator(".card-brutal").first();
    await expect(card).toBeVisible();

    const borderRadius = await card.evaluate(
      (el) => getComputedStyle(el).borderRadius
    );
    // rounded-2xl = 1rem = 16px
    const numericRadius = parseFloat(borderRadius);
    expect(numericRadius).toBeGreaterThan(0);
  });

  test("buttons are pill-shaped (border-radius: 9999px)", async ({ page }) => {
    const button = page.locator(".btn-brutal").first();
    await expect(button).toBeVisible();

    const borderRadius = await button.evaluate(
      (el) => getComputedStyle(el).borderRadius
    );
    // rounded-full = 9999px
    const numericRadius = parseFloat(borderRadius);
    expect(numericRadius).toBeGreaterThanOrEqual(9999);
  });

  test("header has backdrop-filter blur (glassmorphism)", async ({ page }) => {
    const header = page.locator("header").first();
    await expect(header).toBeVisible();

    // The glassmorphism container is inside the header
    const glassContainer = header.locator(".backdrop-blur-md");
    await expect(glassContainer).toBeVisible();

    const backdropFilter = await glassContainer.evaluate((el) => {
      const cs = getComputedStyle(el) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
      return cs.backdropFilter || cs.webkitBackdropFilter || "";
    });
    expect(backdropFilter).toContain("blur");
  });

  test("noise texture pseudo-element exists on body", async ({ page }) => {
    // Check for the ::before pseudo-element on body
    const hasNoise = await page.evaluate(() => {
      const style = getComputedStyle(document.body, "::before");
      // The noise texture should have a background-image and low opacity
      return (
        style.content !== "none" &&
        style.content !== "" &&
        parseFloat(style.opacity) < 0.1
      );
    });
    expect(hasNoise).toBe(true);
  });

  test("mobile: hamburger menu visible, desktop nav hidden", async ({ page }) => {
    const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
    if (!isMobile) {
      test.skip(true, "Mobile-only test");
      return;
    }

    // Hamburger button should be visible
    const hamburger = page.locator("button").filter({ has: page.locator("svg.lucide-menu") });
    await expect(hamburger).toBeVisible();

    // Desktop nav should be hidden
    const desktopNav = page.locator("nav.hidden.md\\:flex");
    await expect(desktopNav).toBeHidden();
  });

  test("mobile negotiate: FAB button visible at bottom-left", async ({ page }) => {
    const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
    if (!isMobile) {
      test.skip(true, "Mobile-only test");
      return;
    }

    // Create a deal to get to negotiate page
    await page.goto("/deals/new");
    await expect(page.locator("text=Loading contract types")).toBeHidden({ timeout: 10_000 });
    await page.locator("h3", { hasText: "NDA" }).first().click();
    await page.locator("text=California, USA").click();
    await page.locator("input#dealName").fill(`E2E Visual ${Date.now()}`);
    await page.locator("button", { hasText: "Continue" }).click();
    await page.waitForURL("**/negotiate", { timeout: 15_000 });

    // FAB should be visible at bottom-left
    const fab = page.locator("button.fixed.bottom-6.left-6");
    await expect(fab).toBeVisible();

    // Verify it's positioned at bottom-left
    const box = await fab.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThan(600); // Near bottom
    expect(box!.x).toBeLessThan(100); // Near left
  });
});
