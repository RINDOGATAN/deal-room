import { test, expect } from "@playwright/test";
import { trialLogin } from "./helpers/auth";
import { createDealWithOptions } from "./helpers/deal";

// Regex patterns for date format assertions
const US_DATE = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}/;
const EU_DATE_EN = /\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}/;
const ES_DATE = /\d{1,2} (?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic) \d{4}/;

test.describe("Date Formats by Jurisdiction", () => {
  test("California deal shows US date format on deals list", async ({ page }) => {
    test.setTimeout(60_000);
    await trialLogin(page);

    await createDealWithOptions(page, {
      contractType: "Data Processing Agreement",
      jurisdiction: "California, USA",
      language: "English",
      dealName: `DateFmt CA ${Date.now()}`,
    });

    await page.goto("/deals");
    await expect(page.locator("text=My Deals").first()).toBeVisible({ timeout: 10_000 });

    // Find the deal card text containing "Updated" — should match US format (MMM d, yyyy)
    const updatedText = page.locator("span", { hasText: /Updated /i }).first();
    await expect(updatedText).toBeVisible({ timeout: 10_000 });
    const text = await updatedText.textContent();
    expect(text).toMatch(US_DATE);
  });

  test("UK deal shows European date format on deals list", async ({ page }) => {
    test.setTimeout(60_000);
    await trialLogin(page);

    await createDealWithOptions(page, {
      contractType: "Data Processing Agreement",
      jurisdiction: "England & Wales, UK",
      language: "English",
      dealName: `DateFmt UK ${Date.now()}`,
    });

    await page.goto("/deals");
    await expect(page.locator("text=My Deals").first()).toBeVisible({ timeout: 10_000 });

    // Find the deal card with "Updated" — should match EU format (d MMM yyyy)
    const updatedText = page.locator("span", { hasText: /Updated /i }).first();
    await expect(updatedText).toBeVisible({ timeout: 10_000 });
    const text = await updatedText.textContent();
    expect(text).toMatch(EU_DATE_EN);
  });

  test("Spain deal in Spanish shows Spanish month names", async ({ page }) => {
    test.setTimeout(60_000);
    await trialLogin(page);

    await createDealWithOptions(page, {
      contractType: "Data Processing Agreement",
      jurisdiction: "Spain, EU",
      language: "Español",
      dealName: `DateFmt ES ${Date.now()}`,
    });

    // Switch to Spanish locale before viewing deals list
    await page.context().addCookies([{
      name: "NEXT_LOCALE",
      value: "es",
      path: "/",
      domain: new URL(page.url()).hostname,
    }]);

    await page.goto("/deals");
    await expect(page.locator("text=Mis Acuerdos").first()).toBeVisible({ timeout: 10_000 });

    // "Actualizado" with Spanish month abbreviations
    const updatedText = page.locator("span", { hasText: /Actualizado /i }).first();
    await expect(updatedText).toBeVisible({ timeout: 10_000 });
    const text = await updatedText.textContent();
    expect(text).toMatch(ES_DATE);
  });

  test("deal detail page shows correct date format", async ({ page }) => {
    test.setTimeout(60_000);
    await trialLogin(page);

    const dealId = await createDealWithOptions(page, {
      contractType: "Data Processing Agreement",
      jurisdiction: "California, USA",
      language: "English",
      dealName: `DateDetail ${Date.now()}`,
    });

    await page.goto(`/deals/${dealId}`);

    // "Created" span should contain a US-format date
    const createdText = page.locator("span", { hasText: /Created /i }).first();
    await expect(createdText).toBeVisible({ timeout: 10_000 });
    const text = await createdText.textContent();
    expect(text).toMatch(US_DATE);
  });

  test("locale toggle changes date format on deals list", async ({ page }) => {
    test.setTimeout(90_000);
    await trialLogin(page);

    // Create a California deal (US format in EN, Spanish format in ES)
    await createDealWithOptions(page, {
      contractType: "Data Processing Agreement",
      jurisdiction: "California, USA",
      language: "English",
      dealName: `DateToggle ${Date.now()}`,
    });

    await page.goto("/deals");
    await expect(page.locator("text=My Deals").first()).toBeVisible({ timeout: 10_000 });

    // EN locale: should show US date format with "Updated"
    const updatedTextEN = page.locator("span", { hasText: /Updated /i }).first();
    await expect(updatedTextEN).toBeVisible({ timeout: 10_000 });
    const enText = await updatedTextEN.textContent();
    expect(enText).toMatch(US_DATE);

    // Toggle to Spanish
    const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
    if (isMobile) {
      await page.locator("button").filter({ has: page.locator("svg.lucide-menu") }).click();
    }
    await page.locator("button", { hasText: "EN" }).click();
    await expect(page.locator("text=Mis Acuerdos").first()).toBeVisible({ timeout: 10_000 });

    // ES locale: California deals still show US month-first format, but with Spanish month names
    // because `isSpanish` takes precedence → d MMM yyyy with es locale
    const updatedTextES = page.locator("span", { hasText: /Actualizado /i }).first();
    await expect(updatedTextES).toBeVisible({ timeout: 10_000 });
    const esText = await updatedTextES.textContent();
    expect(esText).toMatch(ES_DATE);
  });
});
