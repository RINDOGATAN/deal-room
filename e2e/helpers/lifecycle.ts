import { type Page, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const PDF_OUTPUT_DIR = path.join(process.cwd(), "e2e", "output", "contracts");

/**
 * After walking all clauses and selecting the last one, clicks the submit button.
 * For solo mode: "Confirm & Generate" / "Confirmar y generar documento"
 * For negotiation mode: "Submit All Selections" / "Enviar Todas las Selecciones"
 *
 * Returns the deal ID from the current URL.
 */
export async function submitSelections(page: Page): Promise<string> {
  const submitButton = page.locator("button").filter({
    hasText: /Submit All Selections|Confirm.*Generate|Enviar Todas|Confirmar y generar/i,
  });
  await expect(submitButton).toBeVisible({ timeout: 10_000 });
  await expect(submitButton).toBeEnabled({ timeout: 5_000 });
  await submitButton.click();

  // Wait for redirect — either to /deals/{id} (solo) or /deals/{id}/review (negotiation)
  await page.waitForURL(/\/deals\/[^/]+(\/review)?$/, { timeout: 30_000 });

  const url = page.url();
  const match = url.match(/\/deals\/([^/]+)/);
  if (!match) throw new Error(`Could not extract deal ID from URL: ${url}`);
  return match[1];
}

/**
 * On the deal detail page, opens the "Invite Counterparty" dialog and sends an invitation.
 */
export async function inviteCounterparty(
  page: Page,
  email: string,
  name?: string,
  company?: string,
): Promise<void> {
  const inviteButton = page.locator("button").filter({
    hasText: /Invite Counterparty|Invitar contraparte/i,
  });
  await expect(inviteButton).toBeVisible({ timeout: 10_000 });
  await inviteButton.click();

  // Wait for dialog
  await expect(page.locator("[role=dialog]")).toBeVisible({ timeout: 5_000 });

  // Fill email
  const emailInput = page.locator("[role=dialog] input[type=email]");
  await emailInput.fill(email);

  // Fill optional fields
  if (name) {
    const nameInput = page.locator("[role=dialog] input").nth(1);
    await nameInput.fill(name);
  }
  if (company) {
    const companyInput = page.locator("[role=dialog] input").nth(2);
    await companyInput.fill(company);
  }

  // Click send
  const sendButton = page.locator("[role=dialog] button").filter({
    hasText: /Send Invitation|Enviar invitación/i,
  });
  await sendButton.click();

  // Wait for dialog to close
  await expect(page.locator("[role=dialog]")).toBeHidden({ timeout: 10_000 });
}

/**
 * On the review page, clicks "Proceed to Signing" after all clauses are agreed.
 * For solo mode deals, all clauses are auto-agreed so this should work immediately.
 */
export async function proceedToSigning(page: Page, dealId: string): Promise<void> {
  await page.goto(`/deals/${dealId}/review`);

  // Wait for the "All Clauses Agreed" state or "Proceed to Signing" button
  const proceedButton = page.locator("button, a").filter({
    hasText: /Proceed to Signing|Proceder a la [Ff]irma|Proceder a [Ff]irma/i,
  });

  await expect(proceedButton).toBeVisible({ timeout: 30_000 });
  await proceedButton.click();

  await page.waitForURL(`**/deals/${dealId}/sign`, { timeout: 15_000 });
}

/**
 * On the sign page, initiates signing, fills execution details, and signs.
 */
export async function signContract(page: Page, opts: {
  legalName: string;
  address: string;
  signatoryName: string;
  signatoryTitle: string;
}): Promise<void> {
  // If we see "Final Details" / "Últimos detalles", click to initiate
  const initiateButton = page.locator("button").filter({
    hasText: /Final Details|Últimos detalles/i,
  });
  if (await initiateButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await initiateButton.click();
    // Wait for form to appear
    await page.waitForTimeout(2_000);
    // Reload to get updated state
    await page.reload();
    await page.waitForLoadState("networkidle");
  }

  // Fill execution details if the form is visible
  const legalNameInput = page.locator("input.input-brutal").first();
  if (await legalNameInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    const inputs = page.locator("input.input-brutal");
    // Order: legalName, address, taxId, signatoryName, signatoryTitle
    await inputs.nth(0).fill(opts.legalName);
    await inputs.nth(1).fill(opts.address);
    // Skip taxId (nth(2)) — optional
    await inputs.nth(3).fill(opts.signatoryName);
    await inputs.nth(4).fill(opts.signatoryTitle);

    // Click "Confirm Details"
    const confirmButton = page.locator("button").filter({
      hasText: /Confirm Details|Confirmar Datos/i,
    });
    await expect(confirmButton).toBeEnabled({ timeout: 5_000 });
    await confirmButton.click();

    // Wait for confirmation
    await page.waitForTimeout(2_000);
  }

  // Type signature
  const sigInput = page.locator("input.input-brutal.text-lg");
  if (await sigInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await sigInput.fill(opts.signatoryName);

    // Check confirmation checkbox
    const checkbox = page.locator("input[type=checkbox]");
    await checkbox.check();

    // Click "Sign Contract"
    const signButton = page.locator("button").filter({
      hasText: /Sign Contract|Firmar Contrato/i,
    });
    await expect(signButton).toBeEnabled({ timeout: 5_000 });
    await signButton.click();

    // Wait for signature to be recorded
    await page.waitForTimeout(3_000);
  }
}

/**
 * On the review page, clicks "Generate Compromise Suggestions" and waits for generation.
 * Should only be called once per round (typically by the initiator).
 */
export async function generateCompromises(page: Page): Promise<void> {
  const generateBtn = page.locator("button").filter({
    hasText: /Generate Compromise|Generar Propuestas/i,
  });
  await expect(generateBtn).toBeVisible({ timeout: 10_000 });
  await generateBtn.click();
  // Wait for compromise generation to complete
  await expect(generateBtn).toBeHidden({ timeout: 60_000 });
  await page.waitForLoadState("networkidle");

  // Wait for suggestion cards to render (Accept buttons should appear)
  const acceptBtn = page.locator("button.btn-brutal").filter({
    hasText: /Accept|Aceptar/,
  });
  // Suggestion cards may take a moment to render after the refetch
  await expect(acceptBtn.first()).toBeVisible({ timeout: 15_000 });
}

/**
 * On the review page, accepts all pending compromise suggestions.
 * Call for each party after compromises have been generated.
 * If no accept buttons are found, reloads the page once and retries.
 */
export async function acceptAllCompromises(page: Page): Promise<void> {
  const getAcceptButtons = () =>
    page.locator("button.btn-brutal").filter({ hasText: /Accept|Aceptar/ });

  // Wait for accept buttons to appear (may need page reload after generation)
  let acceptButtons = getAcceptButtons();
  let count = await acceptButtons.count();
  if (count === 0) {
    // Buttons not yet rendered — reload to pick up fresh data
    await page.reload();
    await page.waitForLoadState("networkidle");
    acceptButtons = getAcceptButtons();
    count = await acceptButtons.count();
  }

  // Click each accept button sequentially (they trigger mutations)
  const MAX_CLICKS = 50;
  let clicks = 0;
  while (count > 0 && clicks < MAX_CLICKS) {
    const btn = acceptButtons.first();
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    clicks++;
    // Wait for mutation + re-render
    await page.waitForTimeout(2_000);
    acceptButtons = getAcceptButtons();
    count = await acceptButtons.count();
  }

  await page.waitForLoadState("networkidle");
}

/**
 * Downloads the contract PDF for a deal and saves it to e2e/output/contracts/.
 * Requires the deal to be in AGREED, SIGNING, or COMPLETED status.
 * Returns the path to the saved file.
 */
export async function downloadContractPDF(
  page: Page,
  dealId: string,
  filename: string,
): Promise<string> {
  fs.mkdirSync(PDF_OUTPUT_DIR, { recursive: true });

  const response = await page.request.get(`/api/deals/${dealId}/document`);
  if (response.status() !== 200) {
    const body = await response.text();
    throw new Error(`PDF download failed (${response.status()}): ${body}`);
  }

  const buffer = await response.body();
  const outputPath = path.join(PDF_OUTPUT_DIR, `${filename}.pdf`);
  fs.writeFileSync(outputPath, buffer);

  return outputPath;
}

/**
 * Full solo-mode lifecycle: create → walk clauses → submit → sign.
 * Returns the deal ID.
 */
export async function runSoloLifecycle(
  page: Page,
  createDealFn: () => Promise<string>,
  walkClausesFn: (count: number) => Promise<void>,
  getClauseCountFn: () => Promise<number>,
): Promise<string> {
  const dealId = await createDealFn();
  const clauseCount = await getClauseCountFn();
  await walkClausesFn(clauseCount);
  await submitSelections(page);

  // Solo mode: lands on deal detail page, navigate to sign
  await page.goto(`/deals/${dealId}/sign`);
  await page.waitForLoadState("networkidle");

  await signContract(page, {
    legalName: "E2E Test Corp",
    address: "100 Test St, San Francisco, CA 94105",
    signatoryName: "E2E Test User",
    signatoryTitle: "CEO",
  });

  return dealId;
}
