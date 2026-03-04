import { test, expect } from "@playwright/test";
import { trialLogin } from "./helpers/auth";

interface PerfBudget {
  label: string;
  route: string;
  requiresAuth: boolean;
  fullLoadMs: number;
  domInteractiveMs: number;
}

const BUDGETS: PerfBudget[] = [
  {
    label: "Sign-in",
    route: "/sign-in",
    requiresAuth: false,
    fullLoadMs: 2000,
    domInteractiveMs: 1500,
  },
  {
    label: "Deals list",
    route: "/deals",
    requiresAuth: true,
    fullLoadMs: 3000,
    domInteractiveMs: 2000,
  },
  {
    label: "New deal",
    route: "/deals/new",
    requiresAuth: true,
    fullLoadMs: 3000,
    domInteractiveMs: 2000,
  },
];

// Mobile gets +1s leniency
const MOBILE_LENIENCY_MS = 1000;

async function getNavigationMetrics(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const [nav] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    if (!nav) return null;
    return {
      domContentLoaded: Math.round(
        nav.domContentLoadedEventEnd - nav.startTime,
      ),
      fullLoad: Math.round(nav.loadEventEnd - nav.startTime),
      domInteractive: Math.round(nav.domInteractive - nav.startTime),
      transferSize: nav.transferSize,
    };
  });
}

test.describe("Performance Budgets", () => {
  for (const budget of BUDGETS) {
    test(`${budget.label} — loads within budget`, async ({ page }) => {
      const isMobile = (page.viewportSize()?.width ?? 1440) < 768;
      const leniency = isMobile ? MOBILE_LENIENCY_MS : 0;

      if (budget.requiresAuth) {
        await trialLogin(page);
      }

      // Navigate fresh to get clean navigation timing
      await page.goto(budget.route, { waitUntil: "load" });

      const metrics = await getNavigationMetrics(page);
      if (!metrics) {
        test.skip(true, "Navigation Timing API not available");
        return;
      }

      // Log metrics for debugging
      console.log(
        `[perf] ${budget.label} (${isMobile ? "mobile" : "desktop"}):`,
        `domContentLoaded=${metrics.domContentLoaded}ms`,
        `fullLoad=${metrics.fullLoad}ms`,
        `domInteractive=${metrics.domInteractive}ms`,
        `transferSize=${metrics.transferSize}`,
      );

      expect(
        metrics.fullLoad,
        `${budget.label} full load ${metrics.fullLoad}ms exceeds budget ${budget.fullLoadMs + leniency}ms`,
      ).toBeLessThanOrEqual(budget.fullLoadMs + leniency);

      expect(
        metrics.domInteractive,
        `${budget.label} DOM interactive ${metrics.domInteractive}ms exceeds budget ${budget.domInteractiveMs + leniency}ms`,
      ).toBeLessThanOrEqual(budget.domInteractiveMs + leniency);
    });
  }

  test("Deals list — DOM size under 3000 elements", async ({ page }) => {
    await trialLogin(page);
    await page.goto("/deals", { waitUntil: "load" });

    const domSize = await page.evaluate(
      () => document.querySelectorAll("*").length,
    );

    console.log(`[perf] DOM size on /deals: ${domSize} elements`);
    expect(
      domSize,
      `DOM has ${domSize} elements, exceeds budget of 3000`,
    ).toBeLessThan(3000);
  });
});
