/**
 * DPA international transfers — wizard-level regression spec.
 *
 * Locks in the 2026-08-08 behavior changes:
 *  - the Transfer Impact Assessment question defaults to YES (it was
 *    opt-in and easy to miss, which shipped US-processor DPAs without
 *    the Clause 14 assessment);
 *  - the processor-establishment choice renders localized labels and
 *    US selection works;
 *  - the custom governing law / courts open fields sit at the end of
 *    the deal parameters;
 *  - deal creation succeeds with a US-established processor.
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("DPA — international transfers wizard", () => {
  test("US processor: TIA defaults on, custom law fields present, deal creates", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await loginAs(page, "alice@example.com");
    await page.evaluate(async () => {
      await fetch("/api/trpc/lawyer.setRole?batch=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "0": { json: { role: "BUSINESS_OWNER" } } }),
        credentials: "include",
      });
    });
    await loginAs(page, "alice@example.com");

    await page.goto("/deals/new");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Contract type → jurisdiction → language → mode. Force clicks: the
    // Next dev overlay can sit over the cards when run against `next dev`.
    await page.locator("text=Data Processing").first().click({ force: true });
    await page.waitForTimeout(500);
    await page.locator("text=Spain").first().click({ force: true });
    await page.waitForTimeout(500);
    await page.locator("text=English").first().click({ force: true });
    await page.waitForTimeout(500);
    // Mode step is hidden on the self-host posture (solo picked
    // automatically); click it only when the selector renders (hosted).
    const soloOption = page
      .locator("text=Configure & download")
      .or(page.locator("text=Configurar y descargar"));
    if (await soloOption.isVisible().catch(() => false)) {
      await soloOption.click({ force: true });
      await page.waitForTimeout(500);
    }

    // Deal name
    const dealInput = page
      .locator('input[placeholder*="Acme"], input[placeholder*="nombre"], input[placeholder*="e.g"]')
      .first();
    await expect(dealInput).toBeVisible({ timeout: 5000 });
    await dealInput.fill(`DPA transfers e2e ${Date.now()}`);

    // Required DPA parameters
    await page
      .getByLabel(/purpose of the processing/i)
      .fill("Providing the contracted analytics service.");
    await page.locator('button:has-text("Contact details")').first().click();

    // Processor establishment: localized label pills, pick the US
    await expect(
      page.locator('button:has-text("United States")').first(),
    ).toBeVisible({ timeout: 5000 });
    await page.locator('button:has-text("United States")').first().click();

    // Optional parameters live behind the collapsed Advanced settings group
    await page
      .locator("text=/Advanced settings|Ajustes avanzados/")
      .first()
      .click({ force: true });
    await page.waitForTimeout(300);

    // TIA question must be pre-selected YES (the regression this spec pins)
    const tiaYes = page.locator('button:has-text("Yes — attach as Annex IV")');
    await expect(tiaYes).toBeVisible({ timeout: 5000 });
    await expect(tiaYes).toHaveClass(/bg-primary/);

    // UK Addendum / Swiss adaptations default YES as well
    await expect(
      page.locator('button:has-text("Yes — incorporate by reference")'),
    ).toHaveClass(/bg-primary/);
    await expect(
      page.locator('button:has-text("Yes — include adaptations")'),
    ).toHaveClass(/bg-primary/);

    // Custom law/courts open fields exist at the end of the parameter list
    await expect(page.getByLabel(/Custom governing law/i)).toBeVisible();
    await expect(page.getByLabel(/Custom courts/i)).toBeVisible();
    await page
      .getByLabel(/Custom governing law/i)
      .fill("the State of Delaware and applicable United States federal law");
    await page
      .getByLabel(/Custom courts/i)
      .fill("the state and federal courts located in New York County, New York");

    // Create
    const createBtn = page.locator("button").filter({ hasText: /Continue|Continuar/i }).first();
    await createBtn.scrollIntoViewIfNeeded();
    await expect(createBtn).toBeEnabled({ timeout: 5000 });
    await createBtn.click();

    await page.waitForURL(/\/deals\/(?!new)/, { timeout: 15000 });
    expect(page.url()).toMatch(/\/deals\//);
    expect(jsErrors).toEqual([]);
  });
});
