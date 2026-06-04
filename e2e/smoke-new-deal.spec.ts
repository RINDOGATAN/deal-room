/**
 * Smoke test: New Deal page — permutations of contract type,
 * jurisdiction, language, and deal mode (solo vs negotiation).
 *
 * Verifies mode selector appears, deal creation succeeds, no JS errors.
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

interface Scenario {
  name: string;
  contractType: string;
  jurisdiction?: string; // omit for soloModeOnly types (e.g. Privacy Notice)
  language: string;
  mode: "solo" | "negotiation";
  soloModeOnly?: boolean; // skips jurisdiction + mode selector
}

const SCENARIOS: Scenario[] = [
  { name: "NDA / California / EN / Solo", contractType: "Non-Disclosure", jurisdiction: "California", language: "English", mode: "solo" },
  { name: "NDA / Spain / ES / Negotiation", contractType: "Non-Disclosure", jurisdiction: "Spain", language: "Español", mode: "negotiation" },
  { name: "MSA / England / EN / Solo", contractType: "Master Services", jurisdiction: "England", language: "English", mode: "solo" },
  { name: "SaaS / California / ES / Solo", contractType: "SaaS Subscription", jurisdiction: "California", language: "Español", mode: "solo" },
  { name: "DPA / Spain / EN / Negotiation", contractType: "Data Processing", jurisdiction: "Spain", language: "English", mode: "negotiation" },
  { name: "SaaS / England / EN / Negotiation", contractType: "SaaS Subscription", jurisdiction: "England", language: "English", mode: "negotiation" },
  { name: "Privacy / ES / Solo", contractType: "Privacy Notice", language: "Español", mode: "solo", soloModeOnly: true },
  { name: "DPA / England / ES / Solo", contractType: "Data Processing", jurisdiction: "England", language: "Español", mode: "solo" },
];

test.describe("New Deal — Smoke Permutations", () => {
  for (const scenario of SCENARIOS) {
    test(scenario.name, async ({ page }) => {
      const jsErrors: string[] = [];
      page.on("pageerror", (err) => jsErrors.push(err.message));

      // Login and set business owner role
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

      // Step 1: Select contract type
      await page.locator(`text=${scenario.contractType}`).first().click();
      await page.waitForTimeout(500);

      // Step 2: Select jurisdiction (skipped for soloModeOnly types)
      if (!scenario.soloModeOnly && scenario.jurisdiction) {
        await page.locator(`text=${scenario.jurisdiction}`).first().click();
        await page.waitForTimeout(500);
      }

      // Step 3: Select language
      await page.locator(`text=${scenario.language}`).first().click();
      await page.waitForTimeout(500);

      // Step 4: Mode selector (skipped for soloModeOnly types)
      if (!scenario.soloModeOnly) {
        const soloOption = page.locator("text=Configure & download").or(page.locator("text=Configurar y descargar"));
        const negoOption = page.locator("text=Negotiate with counterparty").or(page.locator("text=Negociar con contraparte"));
        await expect(soloOption).toBeVisible({ timeout: 5000 });
        await expect(negoOption).toBeVisible({ timeout: 5000 });

        if (scenario.mode === "solo") {
          await soloOption.click();
        } else {
          await negoOption.click();
        }
        await page.waitForTimeout(500);
      }

      // Step 5: Fill deal name
      const dealInput = page.locator('input[placeholder*="Acme"], input[placeholder*="nombre"], input[placeholder*="e.g"]').first();
      await expect(dealInput).toBeVisible({ timeout: 5000 });
      await dealInput.fill(`Smoke ${scenario.name} ${Date.now()}`);

      // Step 5b: Fill required deal parameters if present (e.g. Privacy Notice)
      const paramSection = page.locator('text=Deal Parameters');
      if (await paramSection.isVisible().catch(() => false)) {
        // Select first jurisdiction chip if multiSelect appears
        const jurisdictionChip = page.locator('button:has-text("California, USA")');
        if (await jurisdictionChip.isVisible().catch(() => false)) {
          await jurisdictionChip.click();
        }
        // DPA: pick at least one personal-data category chip (required multiSelect)
        const dataCategoryChip = page.locator(
          'button:has-text("Contact details"), button:has-text("Datos de contacto")'
        );
        if (await dataCategoryChip.first().isVisible().catch(() => false)) {
          await dataCategoryChip.first().click();
        }
        // Fill required text/textarea fields by label (EN|ES)
        const paramFields: Record<string, string> = {
          "Company Name": "Smoke Test Corp",
          "Company Website": "https://smoke-test.com",
          "Privacy Contact Email": "privacy@smoke-test.com",
          "purpose of the processing|finalidad del tratamiento": "Providing the contracted service and support.",
        };
        for (const [label, value] of Object.entries(paramFields)) {
          const input = page.getByLabel(new RegExp(label));
          if (await input.isVisible().catch(() => false)) {
            await input.fill(value);
          }
        }
        // Fill date input if visible
        const dateInput = page.locator('input[type="date"]');
        if (await dateInput.first().isVisible().catch(() => false)) {
          await dateInput.first().fill("2026-12-31");
        }
      }

      // Step 6: Click Continue button
      await page.waitForTimeout(300);
      const createBtn = page.locator('button').filter({ hasText: /Continue|Continuar/i }).first();
      await createBtn.scrollIntoViewIfNeeded();
      await expect(createBtn).toBeEnabled({ timeout: 5000 });
      await createBtn.click();

      // Should navigate to a deal page
      await page.waitForURL(/\/deals\/(?!new)/, { timeout: 15000 });
      expect(page.url()).toMatch(/\/deals\//);

      // No JS errors
      expect(jsErrors).toEqual([]);
    });
  }
});
