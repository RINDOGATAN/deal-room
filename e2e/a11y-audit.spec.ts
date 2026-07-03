import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { trialLogin } from "./helpers/auth";

async function selectRole(page: Page, role: "business" | "lawyer") {
  const modal = page.locator("[role=dialog]");
  if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
    const cards = modal.locator("button").filter({ has: page.locator(".w-10.h-10") });
    if (role === "business") {
      await cards.first().click();
    } else {
      await cards.last().click();
    }
    await modal.locator("button.btn-brutal").click();
    await page.waitForTimeout(1500);
  }
}

test.describe("Accessibility Audit", () => {
  test.beforeEach(async ({ page }) => {
    await trialLogin(page);
    await selectRole(page, "business");
  });

  const pages = [
    { name: "Requests", path: "/lawyers/requests" },
    { name: "New Deal", path: "/deals/new" },
    { name: "Deals List", path: "/deals" },
  ];

  for (const p of pages) {
    test(`${p.name} has no critical a11y violations`, async ({ page }) => {
      await page.goto(p.path);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .disableRules(["color-contrast"]) // skip color contrast for dark theme
        .analyze();

      const critical = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );

      if (critical.length > 0) {
        console.log(
          `\n[${p.name}] Critical a11y violations:\n`,
          critical.map((v) => `  - ${v.id}: ${v.description} (${v.nodes.length} instances)`).join("\n")
        );
      }

      expect(critical).toHaveLength(0);
    });
  }
});
