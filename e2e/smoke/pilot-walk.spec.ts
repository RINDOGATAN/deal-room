// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The paths a pilot user takes, walked in a real browser against a local
 * build: landing, sign-in, first-run screen, the deal list, one deal and one
 * startup journey (the two record kinds), opening and editing the deal, the
 * exports, and sign-out. Run by `playwright.smoke.config.ts` at 1280 px and
 * at 390 px.
 *
 * Every step asserts:
 *   - no page answers 500 or more;
 *   - no uncaught exception reaches the browser;
 *   - no request to this product's own API answers 4xx or 5xx, except the
 *     statuses the step names as expected;
 *   - at 390 px, the page does not scroll sideways.
 */

import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { dismissDialogs } from "../helpers/deal";

interface Problem {
  kind: "page-status" | "api-status" | "exception";
  detail: string;
}

class Watcher {
  private problems: Problem[] = [];
  private apiStatuses: { url: string; status: number }[] = [];

  constructor(page: Page, private origin: string) {
    page.on("pageerror", (err) => {
      this.problems.push({ kind: "exception", detail: `${err.name}: ${err.message}` });
    });
    page.on("response", (res) => {
      const url = res.url();
      if (!url.startsWith(this.origin)) return;
      const status = res.status();
      const path = url.slice(this.origin.length);
      if (res.request().resourceType() === "document" && status >= 500) {
        this.problems.push({ kind: "page-status", detail: `${status} ${path}` });
      }
      if (path.startsWith("/api/") && status >= 400) {
        this.apiStatuses.push({ url: path, status });
      }
    });
  }

  /** Problems since the last checkpoint; `allow` lists expected API statuses. */
  drain(allow: number[] = []): Problem[] {
    const found = [
      ...this.problems,
      ...this.apiStatuses
        .filter((r) => !allow.includes(r.status))
        .map((r) => ({ kind: "api-status" as const, detail: `${r.status} ${r.url}` })),
    ];
    this.problems = [];
    this.apiStatuses = [];
    return found;
  }
}

async function checkpoint(
  page: Page,
  watcher: Watcher,
  info: TestInfo,
  step: string,
  allow: number[] = [],
) {
  // Let in-flight requests settle so their statuses count for this step.
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  const problems = watcher.drain(allow);
  const failures = problems.map((p) => `[${step}] ${p.kind}: ${p.detail}`);

  if (info.project.name.startsWith("mobile")) {
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    if (scrollWidth > innerWidth) {
      failures.push(`[${step}] overflow: scrollWidth ${scrollWidth} > innerWidth ${innerWidth}`);
    }
  }

  expect.soft(failures, `step "${step}"`).toEqual([]);
}

test("a pilot user walks the product", async ({ page, baseURL }, info) => {
  const watcher = new Watcher(page, baseURL!);
  const email = `smoke-${info.project.name}-${Date.now()}@dealroom.test`;
  const dealName = `Smoke NDA ${info.project.name}`;

  await test.step("landing", async () => {
    // Self-host posture: no marketing landing, straight to the sign-in.
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in/);
    await checkpoint(page, watcher, info, "landing");
  });

  await test.step("sign in", async () => {
    await page.locator("input#email").fill(email);
    await page.locator("form button[type=submit]").click();
    await page.waitForURL("**/deals", { timeout: 30_000 });
    await checkpoint(page, watcher, info, "sign in");
  });

  await test.step("first-run screen", async () => {
    // A new account is asked how it will use Dealroom before anything else.
    await expect(page.locator("[role=dialog]")).toBeVisible();
    await dismissDialogs(page);
    await expect(page.locator("[role=dialog]")).toBeHidden();
    await checkpoint(page, watcher, info, "first-run screen");
  });

  await test.step("main list", async () => {
    await page.goto("/deals");
    await expect(page.locator("h1").first()).toBeVisible();
    await checkpoint(page, watcher, info, "main list");
  });

  let dealId = "";
  await test.step("create a deal", async () => {
    await page.goto("/deals/new");
    await dismissDialogs(page);
    await page.locator("h3", { hasText: "Non-Disclosure Agreement" }).first().click();
    await page
      .locator("button")
      .filter({ has: page.locator("h3", { hasText: "California" }) })
      .first()
      .click();
    await page.locator("input#dealName").fill(dealName);
    const create = page.locator("button", { hasText: /^\s*continue\s*$/i }).last();
    await expect(create).toBeEnabled();
    await create.click();
    await page.waitForURL("**/negotiate", { timeout: 30_000 });
    dealId = page.url().match(/\/deals\/([^/]+)\/negotiate/)![1];
    await checkpoint(page, watcher, info, "create a deal");
  });

  await test.step("open the deal from the list", async () => {
    await page.goto("/deals");
    await page.locator("a", { hasText: dealName }).first().click();
    await page.waitForURL(new RegExp(`/deals/${dealId}`));
    await checkpoint(page, watcher, info, "open the deal");
  });

  await test.step("edit the deal (choose every clause, generate)", async () => {
    await page.goto(`/deals/${dealId}/negotiate`);
    await dismissDialogs(page);
    const header = page.locator("p", { hasText: /Clause \d+ of \d+/ }).first();
    await expect(header).toBeVisible();
    const total = Number((await header.textContent())!.match(/of (\d+)/)![1]);
    for (let i = 0; i < total; i++) {
      const title = await page.locator("h2").first().textContent();
      const card = page.locator(".card-brutal.cursor-pointer").first();
      await card.locator(".rounded-full.border-2").first().click();
      if (i < total - 1) {
        const next = page.locator("button", { hasText: /^Continue$/ });
        await expect(next).toBeEnabled();
        await next.click({ force: true });
        await expect(page.locator("h2").first()).not.toHaveText(title!);
      }
    }
    const submit = page.locator("button").filter({ hasText: /Confirm.*Generate|Submit All Selections/i });
    await submit.click();
    await page.waitForURL(new RegExp(`/deals/${dealId}(/review)?$`), { timeout: 60_000 });
    await checkpoint(page, watcher, info, "edit the deal");
  });

  await test.step("export", async () => {
    for (const path of [
      `/api/deals/${dealId}/document`,
      `/api/deals/${dealId}/document/docx`,
      `/api/deals/${dealId}/document/txt`,
      `/api/account/export`,
    ]) {
      const res = await page.request.get(path);
      expect.soft(res.status(), `export ${path}`).toBe(200);
      expect.soft((await res.body()).length, `export ${path} is not empty`).toBeGreaterThan(0);
    }
    await checkpoint(page, watcher, info, "export");
  });

  await test.step("create a startup journey", async () => {
    await page.goto("/launch/new");
    await page.locator("input#companyName").fill("Smoke Test Inc.");
    await page.locator("button", { hasText: "Next: founders" }).click();
    await page.locator("input#f-0-name").fill("Smoke Founder");
    await page.locator("input#f-0-email").fill(email);
    await page.locator("input#f-0-eq").fill("100");
    await page.locator("button", { hasText: /^\s*Review\s*$/ }).click();
    await page.locator("button", { hasText: "Create journey" }).click();
    await page.waitForURL(/\/launch\/[^/]+$/, { timeout: 30_000 });
    await checkpoint(page, watcher, info, "create a startup journey");
  });

  await test.step("open the journey from its list", async () => {
    await page.goto("/launch");
    await page.locator("a", { hasText: "Smoke Test Inc." }).first().click();
    await page.waitForURL(/\/launch\/[^/]+$/);
    await checkpoint(page, watcher, info, "open the journey");
  });

  await test.step("sign out", async () => {
    await page.goto("/deals");
    if (info.project.name.startsWith("mobile")) {
      await page.locator("button[aria-label]").filter({ has: page.locator("svg.lucide-menu") }).click();
    }
    await page.locator("button:visible", { hasText: "Sign Out" }).click();
    await page.waitForURL("**/sign-in", { timeout: 30_000 });
    // After sign-out, the account's own data must be refused.
    const res = await page.request.get("/api/account/export");
    expect(res.status()).toBe(401);
    await checkpoint(page, watcher, info, "sign out", [401]);
  });
});
