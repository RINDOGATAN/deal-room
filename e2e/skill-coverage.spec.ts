import { test, expect } from "@playwright/test";
import { trialLogin } from "./helpers/auth";
import {
  createDealWithOptions,
  getClauseCount,
  walkAllClauses,
} from "./helpers/deal";

const TIMESTAMP = Date.now();

const SEED_PARAMS = {
  "pre-money-valuation": "2000000",
  "investment-amount": "500000",
  "share-count": "500000",
  "share-price": "1",
  "board-size": "3",
};

const SKILL_MATRIX = [
  {
    tag: "NDA CA-EN",
    contractType: "Non-Disclosure Agreement",
    jurisdiction: "California, USA",
    language: "English",
  },
  {
    tag: "NDA ES-ES",
    contractType: "Non-Disclosure Agreement",
    jurisdiction: "Spain, EU",
    language: "Español",
  },
  {
    tag: "MSA CA-EN",
    contractType: "Master Services Agreement",
    jurisdiction: "California, USA",
    language: "English",
  },
  {
    tag: "SAAS UK-EN",
    contractType: "SaaS Subscription Agreement",
    jurisdiction: "England & Wales, UK",
    language: "English",
  },
  {
    tag: "SEED CA-EN",
    contractType: "Seed Investment Agreement",
    jurisdiction: "California, USA",
    language: "English",
    parameters: SEED_PARAMS,
  },
  {
    tag: "SEED ES-ES",
    contractType: "Pacto de Inversión",
    jurisdiction: "Spain, EU",
    language: "Español",
    parameters: SEED_PARAMS,
  },
] as const;

test.describe("Skill Coverage — All Free Skills", () => {
  test.describe.configure({ mode: "parallel" });

  for (const combo of SKILL_MATRIX) {
    test(`${combo.tag}: create + walk all clauses`, async ({ page }) => {
      test.setTimeout(180_000);

      // Skip on mobile — clause-walking already covered via DPA
      const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
      if (isMobile) {
        test.skip(true, "Desktop-only skill coverage test");
        return;
      }

      // Collect console errors for React crash detection
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await trialLogin(page);

      const dealId = await createDealWithOptions(page, {
        contractType: combo.contractType,
        jurisdiction: combo.jurisdiction,
        language: combo.language,
        dealName: `Skill ${combo.tag} ${TIMESTAMP}`,
        parameters: "parameters" in combo
          ? { ...combo.parameters }
          : undefined,
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
