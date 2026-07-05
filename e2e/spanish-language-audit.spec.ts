/**
 * Spanish Language Audit — E2E tests verifying that choosing Spanish
 * delivers a fully Spanish experience across the entire user journey:
 * deal creation wizard, negotiate page, clause content, deal detail,
 * document export, and signing page.
 *
 * Uses the NDA skill (free, 9 bilingual clauses) with Spain jurisdiction.
 */
import { test, expect, type Page } from "@playwright/test";
import { trialLogin, loginAs } from "./helpers/auth";
import {
  createDealWithOptions,
  getClauseCount,
  walkAllClauses,
  dismissDialogs,
} from "./helpers/deal";
import { submitSelections } from "./helpers/lifecycle";

// ── Known NDA Spanish clause titles (from skills/nda/clauses.json) ──

const NDA_SPANISH_TITLES = [
  "Duración de la confidencialidad",
  "Divulgaciones permitidas",
  "Definición de Información Confidencial",
  "Devolución o destrucción de la información",
  "Resolución de controversias",
  "Recursos por incumplimiento",
  "Duración del acuerdo",
  "Prohibición de captación de empleados",
  "Derechos de cesión",
];

const NDA_ENGLISH_TITLES = [
  "Confidentiality duration",
  "Permitted disclosures",
  "Definition of confidential information",
  "Return or destruction of information",
  "Dispute resolution",
  "Remedies for breach",
  "Agreement term",
  "Non-solicitation of employees",
  "Assignment rights",
];

// ── Helpers ──

/** Sets the UI locale to Spanish via the NEXT_LOCALE cookie. */
async function setSpanishLocale(page: Page): Promise<void> {
  const url = page.url();
  const domain = new URL(url.startsWith("http") ? url : "http://localhost").hostname;
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "es", path: "/", domain },
  ]);
}

/**
 * Creates a solo-mode Spanish NDA through the wizard (inline, no helper modification).
 * Returns the deal ID.
 */
async function createSoloDealES(page: Page, dealName: string): Promise<string> {
  await page.goto("/deals/new");
  await expect(page.locator("text=Loading contract types")).toBeHidden({ timeout: 10_000 });
  await dismissDialogs(page);

  // Step 1: Select NDA
  await page.locator("h3", { hasText: /Non-Disclosure|Acuerdo de Confidencialidad/i }).first().click();

  // Step 2: Select Spain jurisdiction
  await page.locator("text=Spain").first().click();
  await page.waitForTimeout(500);

  // Step 3: Select Español language
  const langCard = page.locator("h3", { hasText: "Español" }).first();
  await expect(langCard).toBeVisible({ timeout: 5_000 });
  await langCard.click({ force: true });

  // Step 4: Select solo mode
  const soloOption = page.locator("text=Configure & download").or(
    page.locator("text=Configurar y descargar"),
  );
  await expect(soloOption).toBeVisible({ timeout: 5_000 });
  await soloOption.click();
  await page.waitForTimeout(500);

  // Step 5: Fill deal name
  const dealNameInput = page.locator("input#dealName");
  await expect(dealNameInput).toBeVisible({ timeout: 10_000 });
  await dealNameInput.fill(dealName);

  // Submit
  const continueButton = page.locator("button", { hasText: /continue|continuar/i });
  await expect(continueButton).toBeEnabled({ timeout: 10_000 });
  await continueButton.click();

  // Wait for negotiate page
  await page.waitForURL("**/negotiate", { timeout: 15_000 });
  const url = page.url();
  const match = url.match(/\/deals\/([^/]+)\/negotiate/);
  if (!match) throw new Error(`Could not extract deal ID from URL: ${url}`);
  return match[1];
}

// ── Tests ──

test.describe("Spanish Language Audit", () => {
  test("deal creation wizard renders labels in Spanish", async ({ page }) => {
    test.setTimeout(120_000);
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    // Login and set role
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

    // Set UI locale to Spanish
    await setSpanishLocale(page);

    await page.goto("/deals/new");
    await page.waitForLoadState("networkidle").catch(() => {});
    await dismissDialogs(page);

    // Assert wizard heading is in Spanish
    await expect(page.locator("text=Crear Nuevo Acuerdo")).toBeVisible({ timeout: 10_000 });

    // Assert NDA card shows Spanish display name
    await expect(page.locator("h3", { hasText: "Acuerdo de Confidencialidad" })).toBeVisible({ timeout: 10_000 });

    // Click NDA
    await page.locator("h3", { hasText: "Acuerdo de Confidencialidad" }).first().click();
    await page.waitForTimeout(500);

    // Assert jurisdiction step label is in Spanish
    await expect(page.getByText("Ley Aplicable", { exact: true })).toBeVisible({ timeout: 5_000 });

    // Select Spain — in Spanish UI it shows "España"
    await page.locator("text=España").first().click();
    await page.waitForTimeout(500);

    // Assert language step label is in Spanish
    await expect(page.getByText("Idioma del Contrato", { exact: true })).toBeVisible({ timeout: 5_000 });

    // Select Español
    await page.locator("h3", { hasText: "Español" }).first().click({ force: true });
    await page.waitForTimeout(500);

    // Assert deal details step labels are in Spanish
    await expect(page.locator("text=Detalles del Acuerdo")).toBeVisible({ timeout: 5_000 });

    // Fill name and submit
    const dealInput = page.locator("input#dealName");
    await expect(dealInput).toBeVisible({ timeout: 5_000 });
    await dealInput.fill(`Audit Wizard ES ${Date.now()}`);

    // Continue button should be "Continuar"
    const continueBtn = page.locator("button").filter({ hasText: "Continuar" });
    await expect(continueBtn).toBeEnabled({ timeout: 5_000 });
    await continueBtn.click();

    // Should navigate to deal page
    await page.waitForURL(/\/deals\/(?!new)/, { timeout: 15_000 });
    expect(jsErrors).toEqual([]);
  });

  test("negotiate page shows Spanish clause content and UI chrome", async ({ page }) => {
    test.setTimeout(120_000);
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await trialLogin(page);

    // Create a Spanish NDA — the helper uses English card names which are matched by h3
    await createDealWithOptions(page, {
      contractType: "Non-Disclosure Agreement",
      jurisdiction: "Spain, EU",
      language: "Español",
      dealName: `Audit Content ES ${Date.now()}`,
    });

    await dismissDialogs(page);

    // ── Clause progress header ──
    // Should read "Cláusula 1 de N", not "Clause 1 of N"
    const progressText = page.locator("p", { hasText: /Cláusula\s+\d+\s+de\s+\d+/ });
    await expect(progressText).toBeVisible({ timeout: 10_000 });

    // Negative: English progress should NOT appear
    await expect(page.locator("p", { hasText: /^Clause\s+\d+\s+of\s+\d+/ })).not.toBeVisible();

    // ── First clause title ──
    const clauseTitle = page.locator("h2").first();
    await expect(clauseTitle).toContainText("Duración de la confidencialidad", { timeout: 10_000 });

    // Negative: English title should NOT appear
    await expect(page.locator("h2", { hasText: "Confidentiality duration" })).not.toBeVisible();

    // ── Category badge ──
    await expect(page.locator("text=Plazo").first()).toBeVisible({ timeout: 5_000 });

    // ── Clause description ──
    await expect(page.locator("p", { hasText: /cuánto tiempo/ })).toBeVisible({ timeout: 5_000 });

    // ── Option labels ──
    // First option: "2 años" (not "2 years")
    await expect(page.locator("text=2 años").first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("text=2 years")).not.toBeVisible();

    // ── Option description ──
    await expect(page.locator("text=obligaciones de confidencialidad").first()).toBeVisible({ timeout: 5_000 });

    // ── UI label ──
    await expect(page.locator("text=Selecciona tu opción preferida")).toBeVisible({ timeout: 5_000 });

    // ── Expand first option and check legal text ──
    const firstCard = page.locator(".card-brutal.cursor-pointer").first();
    const expandButton = firstCard.locator("button", { hasText: /expand|ver más|texto legal/i }).or(
      firstCard.locator("svg.lucide-chevron-down").first(),
    );
    if (await expandButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expandButton.click();
      // "Texto Legal" label
      await expect(page.locator("text=Texto Legal").first()).toBeVisible({ timeout: 5_000 });
      // Legal text content in Spanish
      await expect(page.locator("text=subsistirán tras su resolución").first()).toBeVisible({ timeout: 5_000 });
    }

    // ── Select option and check firmness label ──
    const radioCircle = firstCard.locator(".rounded-full.border-2").first();
    await radioCircle.click();
    await expect(page.locator("text=Firmeza").first()).toBeVisible({ timeout: 5_000 });

    expect(jsErrors).toEqual([]);
  });

  test("clause titles remain in Spanish across multiple clauses", async ({ page }) => {
    test.setTimeout(120_000);
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await trialLogin(page);

    await createDealWithOptions(page, {
      contractType: "Non-Disclosure Agreement",
      jurisdiction: "Spain, EU",
      language: "Español",
      dealName: `Audit MultiClause ES ${Date.now()}`,
    });

    await dismissDialogs(page);

    const clauseCount = await getClauseCount(page);
    const clausesToCheck = Math.min(clauseCount, 3);

    for (let i = 0; i < clausesToCheck; i++) {
      const isLast = i === clausesToCheck - 1 && clausesToCheck === clauseCount;

      // Get current clause title
      const titleEl = page.locator("h2").first();
      await expect(titleEl).toBeVisible({ timeout: 10_000 });
      const titleText = await titleEl.textContent();

      // Assert title matches one of the known NDA Spanish titles
      const matchesSpanish = NDA_SPANISH_TITLES.some(
        (t) => titleText?.includes(t),
      );
      expect(matchesSpanish, `Clause ${i + 1} title "${titleText}" should match a known Spanish NDA title`).toBe(true);

      // Assert title does NOT match any English title
      const matchesEnglish = NDA_ENGLISH_TITLES.some(
        (t) => titleText?.toLowerCase().includes(t.toLowerCase()),
      );
      expect(matchesEnglish, `Clause ${i + 1} title "${titleText}" should NOT match an English NDA title`).toBe(false);

      // Select first option
      const optionCards = page.locator(".card-brutal.cursor-pointer");
      await expect(optionCards.first()).toBeVisible({ timeout: 10_000 });
      const radioCircle = optionCards.first().locator(".rounded-full.border-2").first();
      await radioCircle.click();

      if (!isLast) {
        // Click Continue
        const continueButton = page.locator("button", { hasText: /^Continue$|^Continuar$/ });
        await expect(continueButton).toBeEnabled({ timeout: 10_000 });
        await continueButton.scrollIntoViewIfNeeded();
        await continueButton.click({ force: true });

        // Wait for title to change
        await expect(page.locator("h2").first()).not.toHaveText(titleText!, { timeout: 10_000 });
      }
    }

    expect(jsErrors).toEqual([]);
  });

  test("deal detail page and TXT document contain Spanish content", async ({ page }) => {
    test.setTimeout(180_000);
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await trialLogin(page);

    // Create solo-mode Spanish NDA
    const dealId = await createSoloDealES(page, `Audit Doc ES ${Date.now()}`);

    await dismissDialogs(page);

    // Walk all clauses and submit
    const clauseCount = await getClauseCount(page);
    await walkAllClauses(page, clauseCount);
    await submitSelections(page);

    // Navigate to deal detail
    await page.goto(`/deals/${dealId}`);
    await page.waitForLoadState("networkidle").catch(() => {});

    // Assert Spanish labels on deal detail page
    const spanishStatusText = page.locator("text=Documento generado").or(
      page.locator("text=Selecciones Enviadas"),
    );
    await expect(spanishStatusText.first()).toBeVisible({ timeout: 15_000 });

    // Fetch TXT document and verify Spanish content
    const response = await page.request.get(`/api/deals/${dealId}/document/txt`);
    expect(response.status()).toBe(200);
    const txtContent = await response.text();

    // Structural labels from contractTxt.ts LABELS.es
    expect(txtContent).toContain("Ley Aplicable");
    // A Spanish clause title should appear
    const hasSpanishTitle = NDA_SPANISH_TITLES.some((t) => txtContent.includes(t));
    expect(hasSpanishTitle, "TXT document should contain at least one Spanish clause title").toBe(true);

    // English structural labels should NOT appear
    expect(txtContent).not.toContain("Governing Law");

    expect(jsErrors).toEqual([]);
  });

  test("sign page renders execution details in Spanish", async ({ page }) => {
    test.setTimeout(180_000);
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await trialLogin(page);

    // Create solo-mode Spanish NDA
    const dealId = await createSoloDealES(page, `Audit Sign ES ${Date.now()}`);

    await dismissDialogs(page);

    // Walk all clauses and submit
    const clauseCount = await getClauseCount(page);
    await walkAllClauses(page, clauseCount);
    await submitSelections(page);

    // Navigate to sign page
    await page.goto(`/deals/${dealId}/sign`);
    await page.waitForLoadState("networkidle").catch(() => {});

    // Assert Spanish sign page heading
    await expect(page.getByRole("heading", { name: "Firma Electrónica" })).toBeVisible({ timeout: 15_000 });

    // Assert "Últimos detalles" button or "Datos de Ejecución" section
    const signingLabel = page.locator("text=Últimos detalles").or(
      page.locator("text=Datos de Ejecución"),
    );
    await expect(signingLabel.first()).toBeVisible({ timeout: 10_000 });

    // If the initiate button is visible, click it to reveal the form
    const initiateButton = page.locator("button", { hasText: /Últimos detalles|Final Details/i });
    if (await initiateButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await initiateButton.click();
      await page.waitForTimeout(2_000);
      await page.reload();
      await page.waitForLoadState("networkidle");
    }

    // Assert execution details form labels are in Spanish
    await expect(page.getByRole("heading", { name: "Datos de Ejecución" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Denominación Social", { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Domicilio Social", { exact: true })).toBeVisible({ timeout: 5_000 });

    // Negative: English equivalents should NOT appear
    await expect(page.getByRole("heading", { name: "Execution Details" })).not.toBeVisible();
    await expect(page.getByText("Legal Name", { exact: true })).not.toBeVisible();

    expect(jsErrors).toEqual([]);
  });
});
