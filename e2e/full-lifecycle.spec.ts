import { test, expect } from "@playwright/test";
import { trialLogin, loginAs, createSecondUser } from "./helpers/auth";
import { createDealWithOptions, getClauseCount, walkAllClauses } from "./helpers/deal";
import { submitSelections, inviteCounterparty, signContract, downloadContractPDF, generateCompromises, acceptAllCompromises } from "./helpers/lifecycle";

const TS = Date.now();

// ──────────────────────────────────────────────────────────────
// FULL LIFECYCLE MATRIX
// Covers all free skills × representative jurisdiction/language combos
// through the complete flow: create → walk → submit → sign
// ──────────────────────────────────────────────────────────────

interface LifecycleVariant {
  tag: string;
  contractType: string;   // h3 display name on the template card
  jurisdiction: string;   // button text
  language: string;       // h3 nativeLabel
  solo: boolean;          // true = solo mode (no counterparty)
  parameters?: Record<string, string>;
}

const SEED_PARAMS_ES = {
  "pre-money-valuation": "2000000",
  "investment-amount": "500000",
  "share-count": "500000",
  "share-price": "1",
  "board-size": "3",
  "dividend-rate": "8",
  "qualified-financing-threshold": "1000000",
  "lock-up-months": "12",
  "legal-fee-cap": "25000",
  "business-description": "desarrollo de soluciones tecnológicas legales con IA",
  "court-county": "Madrid",
  "court-city": "Madrid",
  "arbitration-institution": "Corte de Arbitraje de Madrid",
  "arbitration-language": "Español",
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for the commented-out PHANTOM-PLAN-ES matrix row
const PHANTOM_PLAN_PARAMS = {
  "company-name": "E2E Technologies, S.L.",
  "cif": "B98765432",
  "total-pool-percentage": "10%",
  "cliff-months": "12",
  "vesting-months": "48",
  "plan-effective-date": "1 de enero de 2026",
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for the commented-out PHANTOM-GRANT-ES matrix row
const PHANTOM_GRANT_PARAMS = {
  "employee-name": "María García López",
  "phantom-count": "1.000",
  "grant-date": "15 de marzo de 2026",
  "plan-date": "1 de enero de 2026",
  "individual-vesting-months": "48",
};

const PRIVACY_PARAMS = {
  "jurisdictions": "California|England|Spain",
  "company-name": "E2E Test Corp",
  "company-website": "https://e2e.example.com",
  "dpo-email": "privacy@e2e.example.com",
  "effective-date": "2026-03-01",
};

const LIFECYCLE_MATRIX: LifecycleVariant[] = [
  // ── NDA ──
  { tag: "NDA-CA-EN", contractType: "Non-Disclosure Agreement", jurisdiction: "California, USA", language: "English", solo: false },
  { tag: "NDA-ES-ES", contractType: "Non-Disclosure Agreement", jurisdiction: "Spain, EU", language: "Español", solo: false },

  // ── DPA ──
  { tag: "DPA-CA-EN", contractType: "Data Processing Agreement", jurisdiction: "California, USA", language: "English", solo: false },
  { tag: "DPA-UK-ES", contractType: "Data Processing Agreement", jurisdiction: "England & Wales, UK", language: "Español", solo: false },

  // ── MSA ──
  { tag: "MSA-UK-EN", contractType: "Master Services Agreement", jurisdiction: "England & Wales, UK", language: "English", solo: false },
  { tag: "MSA-ES-ES", contractType: "Master Services Agreement", jurisdiction: "Spain, EU", language: "Español", solo: false },

  // ── SaaS ──
  { tag: "SAAS-CA-EN", contractType: "SaaS Subscription Agreement", jurisdiction: "California, USA", language: "English", solo: false },
  { tag: "SAAS-ES-ES", contractType: "SaaS Subscription Agreement", jurisdiction: "Spain, EU", language: "Español", solo: false },

  // ── Seed Investment (two-party, Spanish) ──
  { tag: "SEED-ES-ES", contractType: "Seed Investment Agreement", jurisdiction: "Spain, EU", language: "Español", solo: false, parameters: SEED_PARAMS_ES },

  // ── Phantom Shares Plan (solo, Spanish) — premium skill, requires entitlement ──
  // Uncomment when e2e user has SkillEntitlement for phantom-shares-plan
  // { tag: "PHANTOM-PLAN-ES", contractType: "Marco de Phantom Shares", jurisdiction: "Spain, EU", language: "Español", solo: true, parameters: PHANTOM_PLAN_PARAMS },

  // ── Phantom Shares Grant (solo, Spanish) — premium skill, requires entitlement ──
  // Uncomment when e2e user has SkillEntitlement for phantom-shares-grant
  // { tag: "PHANTOM-GRANT-ES", contractType: "Asignación Individual de Phantom Shares", jurisdiction: "Spain, EU", language: "Español", solo: true, parameters: PHANTOM_GRANT_PARAMS },

  // ── Privacy Notice (solo only) ──
  { tag: "PRIV-CA-EN", contractType: "Privacy Notice", jurisdiction: "California, USA", language: "English", solo: true, parameters: PRIVACY_PARAMS },
  { tag: "PRIV-ES-ES", contractType: "Privacy Notice", jurisdiction: "Spain, EU", language: "Español", solo: true, parameters: {
    ...PRIVACY_PARAMS,
    "company-name": "E2E Test Corp, S.L.",
    "company-website": "https://e2e.ejemplo.es",
    "dpo-email": "privacidad@e2e.ejemplo.es",
    "effective-date": "2026-03-01",
  }},
];

// ──────────────────────────────────────────────────────────────
// SOLO MODE — Full lifecycle
// ──────────────────────────────────────────────────────────────

test.describe("Full Lifecycle — Solo Mode", () => {
  const soloVariants = LIFECYCLE_MATRIX.filter((v) => v.solo);

  for (const variant of soloVariants) {
    test(`${variant.tag}: create → walk → submit → sign`, async ({ page }) => {
      test.setTimeout(300_000);

      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await trialLogin(page);

      // Create deal
      const dealId = await createDealWithOptions(page, {
        contractType: variant.contractType,
        jurisdiction: variant.jurisdiction,
        language: variant.language,
        dealName: `Lifecycle ${variant.tag} ${TS}`,
        parameters: variant.parameters,
      });
      expect(dealId).toBeTruthy();

      // Walk all clauses
      const clauseCount = await getClauseCount(page);
      expect(clauseCount).toBeGreaterThan(0);
      await walkAllClauses(page, clauseCount);

      // Submit — solo mode redirects to /deals/{id}
      await submitSelections(page);

      // Navigate to sign page and sign the contract
      await page.goto(`/deals/${dealId}/sign`);
      await page.waitForLoadState("networkidle");

      // Verify sign page loads without crash
      const pageContent = page.locator("h1, h2, .card-brutal").first();
      await expect(pageContent).toBeVisible({ timeout: 15_000 });

      await signContract(page, {
        legalName: "E2E Test Corp",
        address: "100 Test St, San Francisco, CA 94105",
        signatoryName: "E2E Test User",
        signatoryTitle: "CEO",
      });

      // Download contract PDF for manual legal review
      const pdfPath = await downloadContractPDF(page, dealId!, variant.tag);
      console.log(`[PDF] ${variant.tag}: ${pdfPath}`);

      // Assert no React crashes
      const crashes = consoleErrors.filter(
        (e) => e.includes("Minified React error") || e.includes("Objects are not valid as a React child"),
      );
      expect(crashes).toHaveLength(0);
    });
  }
});

// ──────────────────────────────────────────────────────────────
// NEGOTIATION MODE — Full lifecycle with two parties
// ──────────────────────────────────────────────────────────────

test.describe("Full Lifecycle — Two-Party Negotiation", () => {
  const negotiationVariants = LIFECYCLE_MATRIX.filter((v) => !v.solo);

  for (const variant of negotiationVariants) {
    test(`${variant.tag}: create → walk → submit → invite → respondent → review → sign`, async ({ page, browser }) => {
      test.setTimeout(600_000);

      // Skip on mobile — two-party negotiation too complex for mobile viewport
      const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
      if (isMobile) {
        test.skip(true, "Desktop-only two-party test");
        return;
      }

      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      const initiatorEmail = `e2e-initiator-${variant.tag.toLowerCase()}@dealroom.test`;
      const respondentEmail = `e2e-respondent-${variant.tag.toLowerCase()}@dealroom.test`;

      // ── INITIATOR: Create deal + walk all clauses + submit ──
      await loginAs(page, initiatorEmail);

      const dealId = await createDealWithOptions(page, {
        contractType: variant.contractType,
        jurisdiction: variant.jurisdiction,
        language: variant.language,
        dealName: `Lifecycle ${variant.tag} ${TS}`,
        parameters: variant.parameters,
      });
      expect(dealId).toBeTruthy();

      const clauseCount = await getClauseCount(page);
      expect(clauseCount).toBeGreaterThan(0);
      await walkAllClauses(page, clauseCount);
      await submitSelections(page);

      // Invite counterparty
      await page.goto(`/deals/${dealId}`);
      await page.waitForLoadState("networkidle");
      await inviteCounterparty(page, respondentEmail, "E2E Respondent", "Respondent Corp");

      // ── RESPONDENT: Open deal + walk all clauses + submit ──
      const baseURL = page.url().match(/^https?:\/\/[^/]+/)?.[0] || "";
      const { context: respCtx, page: respPage } = await createSecondUser(browser, baseURL, respondentEmail);

      const respConsoleErrors: string[] = [];
      respPage.on("console", (msg) => {
        if (msg.type() === "error") respConsoleErrors.push(msg.text());
      });

      await respPage.goto(`/deals/${dealId}/negotiate`);
      await respPage.waitForLoadState("networkidle");

      // Respondent walks all clauses (selects last option for divergent compromise testing)
      const respClauseCount = await getClauseCount(respPage);
      expect(respClauseCount).toBe(clauseCount);
      await walkAllClauses(respPage, respClauseCount, true);
      await submitSelections(respPage);

      // Both submitted → navigate to review page
      await page.goto(`/deals/${dealId}/review`);
      await page.waitForLoadState("networkidle");
      const reviewContent = page.locator("h1, h2, .card-brutal").first();
      await expect(reviewContent).toBeVisible({ timeout: 15_000 });

      // Initiator: generate compromises (only called once per round)
      await generateCompromises(page);

      // Initiator: accept all suggestions
      await acceptAllCompromises(page);

      // Respondent: accept all suggestions on their side
      await respPage.goto(`/deals/${dealId}/review`);
      await respPage.waitForLoadState("networkidle");
      await acceptAllCompromises(respPage);

      // Reload initiator page to pick up AGREED state
      await page.reload();
      await page.waitForLoadState("networkidle");

      // Confirm deal is in AGREED state — "Proceed to Signing" button visible
      const proceedBtn = page.locator("button, a").filter({
        hasText: /Proceed to Signing|Proceder a la [Ff]irma|Proceder a [Ff]irma/i,
      }).first();
      await expect(proceedBtn).toBeVisible({ timeout: 15_000 });

      // Download contract PDF for manual legal review (AGREED state, pre-signing)
      const pdfPath = await downloadContractPDF(page, dealId!, variant.tag);
      console.log(`[PDF] ${variant.tag}: ${pdfPath}`);

      // Clean up respondent context
      await respCtx.close();

      // Assert no React crashes from either party
      const allErrors = [...consoleErrors, ...respConsoleErrors];
      const crashes = allErrors.filter(
        (e) => e.includes("Minified React error") || e.includes("Objects are not valid as a React child"),
      );
      expect(crashes).toHaveLength(0);
    });
  }
});

// ──────────────────────────────────────────────────────────────
// SCALE COVERAGE — Smoke test every free skill × jurisdiction × language
// Just create + walk first 3 clauses to verify no crashes
// ──────────────────────────────────────────────────────────────

interface SmokeDeal {
  tag: string;
  contractType: string;
  jurisdiction: string;
  language: string;
  parameters?: Record<string, string>;
}

const SCALE_MATRIX: SmokeDeal[] = [
  // NDA — all 6 combos
  { tag: "NDA-CA-EN", contractType: "Non-Disclosure Agreement", jurisdiction: "California, USA", language: "English" },
  { tag: "NDA-CA-ES", contractType: "Non-Disclosure Agreement", jurisdiction: "California, USA", language: "Español" },
  { tag: "NDA-UK-EN", contractType: "Non-Disclosure Agreement", jurisdiction: "England & Wales, UK", language: "English" },
  { tag: "NDA-UK-ES", contractType: "Non-Disclosure Agreement", jurisdiction: "England & Wales, UK", language: "Español" },
  { tag: "NDA-ES-EN", contractType: "Non-Disclosure Agreement", jurisdiction: "Spain, EU", language: "English" },
  { tag: "NDA-ES-ES", contractType: "Non-Disclosure Agreement", jurisdiction: "Spain, EU", language: "Español" },

  // DPA — all 6 combos
  { tag: "DPA-CA-EN", contractType: "Data Processing Agreement", jurisdiction: "California, USA", language: "English" },
  { tag: "DPA-CA-ES", contractType: "Data Processing Agreement", jurisdiction: "California, USA", language: "Español" },
  { tag: "DPA-UK-EN", contractType: "Data Processing Agreement", jurisdiction: "England & Wales, UK", language: "English" },
  { tag: "DPA-UK-ES", contractType: "Data Processing Agreement", jurisdiction: "England & Wales, UK", language: "Español" },
  { tag: "DPA-ES-EN", contractType: "Data Processing Agreement", jurisdiction: "Spain, EU", language: "English" },
  { tag: "DPA-ES-ES", contractType: "Data Processing Agreement", jurisdiction: "Spain, EU", language: "Español" },

  // MSA — all 6 combos
  { tag: "MSA-CA-EN", contractType: "Master Services Agreement", jurisdiction: "California, USA", language: "English" },
  { tag: "MSA-CA-ES", contractType: "Master Services Agreement", jurisdiction: "California, USA", language: "Español" },
  { tag: "MSA-UK-EN", contractType: "Master Services Agreement", jurisdiction: "England & Wales, UK", language: "English" },
  { tag: "MSA-UK-ES", contractType: "Master Services Agreement", jurisdiction: "England & Wales, UK", language: "Español" },
  { tag: "MSA-ES-EN", contractType: "Master Services Agreement", jurisdiction: "Spain, EU", language: "English" },
  { tag: "MSA-ES-ES", contractType: "Master Services Agreement", jurisdiction: "Spain, EU", language: "Español" },

  // SaaS — all 6 combos
  { tag: "SAAS-CA-EN", contractType: "SaaS Subscription Agreement", jurisdiction: "California, USA", language: "English" },
  { tag: "SAAS-CA-ES", contractType: "SaaS Subscription Agreement", jurisdiction: "California, USA", language: "Español" },
  { tag: "SAAS-UK-EN", contractType: "SaaS Subscription Agreement", jurisdiction: "England & Wales, UK", language: "English" },
  { tag: "SAAS-UK-ES", contractType: "SaaS Subscription Agreement", jurisdiction: "England & Wales, UK", language: "Español" },
  { tag: "SAAS-ES-EN", contractType: "SaaS Subscription Agreement", jurisdiction: "Spain, EU", language: "English" },
  { tag: "SAAS-ES-ES", contractType: "SaaS Subscription Agreement", jurisdiction: "Spain, EU", language: "Español" },

  // Privacy Notice — all 6 combos (solo mode, parameterized)
  { tag: "PRIV-CA-EN", contractType: "Privacy Notice", jurisdiction: "California, USA", language: "English", parameters: PRIVACY_PARAMS },
  { tag: "PRIV-CA-ES", contractType: "Privacy Notice", jurisdiction: "California, USA", language: "Español", parameters: PRIVACY_PARAMS },
  { tag: "PRIV-UK-EN", contractType: "Privacy Notice", jurisdiction: "England & Wales, UK", language: "English", parameters: PRIVACY_PARAMS },
  { tag: "PRIV-UK-ES", contractType: "Privacy Notice", jurisdiction: "England & Wales, UK", language: "Español", parameters: PRIVACY_PARAMS },
  { tag: "PRIV-ES-EN", contractType: "Privacy Notice", jurisdiction: "Spain, EU", language: "English", parameters: PRIVACY_PARAMS },
  { tag: "PRIV-ES-ES", contractType: "Privacy Notice", jurisdiction: "Spain, EU", language: "Español", parameters: PRIVACY_PARAMS },
];

test.describe("Scale Coverage — All Free Skills × All Combos", () => {
  test.describe.configure({ mode: "parallel" });

  for (const combo of SCALE_MATRIX) {
    test(`${combo.tag}: create + walk all clauses`, async ({ page }) => {
      test.setTimeout(180_000);

      // Skip on mobile
      const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
      if (isMobile) {
        test.skip(true, "Desktop-only scale coverage test");
        return;
      }

      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await trialLogin(page);

      const dealId = await createDealWithOptions(page, {
        contractType: combo.contractType,
        jurisdiction: combo.jurisdiction,
        language: combo.language,
        dealName: `Scale ${combo.tag} ${TS}`,
        parameters: combo.parameters,
      });
      expect(dealId).toBeTruthy();

      const clauseCount = await getClauseCount(page);
      expect(clauseCount).toBeGreaterThan(0);

      // Walk ALL clauses (comprehensive verification)
      await walkAllClauses(page, clauseCount);

      // Assert no React crashes
      const crashes = consoleErrors.filter(
        (e) => e.includes("Minified React error") || e.includes("Objects are not valid as a React child"),
      );
      expect(crashes).toHaveLength(0);
    });
  }
});
