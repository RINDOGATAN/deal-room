// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The hosted pilot banner: present on hosted (both languages, with the
 * link to todo.law/run), absent on the kit, and mounted only in the
 * signed-in (dashboard) layout: public pages carry no banner.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { PilotBanner } from "@/components/pilot/PilotBanner";

function render(hosted: boolean, locale: "en" | "es" = "en") {
  return renderToStaticMarkup(
    createElement(
      // Children go in the third argument; the provider's props type
      // requires them in the props object, hence the widened type.
      NextIntlClientProvider as ComponentType<Record<string, unknown>>,
      { locale, messages: locale === "es" ? es : en, timeZone: "UTC" },
      createElement(PilotBanner, { hosted }),
    ),
  );
}

describe("PilotBanner", () => {
  it("shows the pilot sentence and the run link on hosted", () => {
    const html = render(true);
    expect(html).toContain('data-testid="pilot-banner"');
    expect(html).toContain("Hosted pilot: free, capped, and with no contractual safeguards.");
    expect(html).toContain("To deploy real customer details,");
    // The owner withdrew this phrase from the banner on 2026-09-20.
    expect(html).not.toContain("security certification");
    expect(html).toContain('href="https://www.todo.law/run"');
    expect(html).toContain("run your own instance");
    // Dismissible.
    expect(html).toContain('aria-label="Dismiss"');
  });

  it("speaks Castilian Spanish with tú", () => {
    const html = render(true, "es");
    expect(html).toContain("Piloto alojado: gratuito, limitado y sin garantías contractuales.");
    expect(html).toContain("Para manejar datos reales de clientes,");
    expect(html).toContain("usa tu propia instancia");
    expect(html).not.toContain("certificación de seguridad");
    expect(html).toContain('href="https://www.todo.law/run"');
    expect(html).toContain('aria-label="Cerrar"');
  });

  it("states the suite-wide clock rule in both languages", () => {
    expect(render(true)).toContain(
      "90 days of editing from your first sign-in, then read-only with export.",
    );
    expect(render(true, "es")).toContain(
      "90 días de edición desde tu primer inicio de sesión; después, solo lectura con exportación.",
    );
  });

  it("uses the same rule sentence on the landing sign-up card and in Settings", () => {
    const landing = (locale: string) =>
      JSON.parse(
        readFileSync(path.resolve(__dirname, `../../../landing/i18n/${locale}/startups-auth.json`), "utf8"),
      ) as Record<string, string>;
    expect(landing("en")["pilot.notice"]).toContain(en.pilot.rule.replace(/\.$/, ""));
    expect(landing("es")["pilot.notice"]).toContain(es.pilot.rule.replace(/\.$/, ""));
    expect(en.pilot.banner).toContain(en.pilot.rule);
    expect(es.pilot.banner).toContain(es.pilot.rule);
  });

  it("renders nothing on the kit", () => {
    expect(render(false)).toBe("");
    expect(render(false, "es")).toBe("");
  });

  // Owner, 2026-09-21: the banner shows only once a person is signed in.
  const src = (rel: string) => readFileSync(path.resolve(__dirname, "../../..", rel), "utf8");

  it("is mounted in the signed-in (dashboard) layout", () => {
    const layout = src("app/(dashboard)/layout.tsx");
    expect(layout).toContain('import { PilotBanner } from "@/components/pilot/PilotBanner"');
    expect(layout).toMatch(/<PilotBanner\s*\/>/);
  });

  it("is absent from the landing page, a docs page and the sign-in screen", () => {
    for (const rel of [
      "app/layout.tsx",
      "app/page.tsx",
      "landing/components/StartupProductPage.tsx",
      "app/(public)/layout.tsx",
      "app/(public)/docs/layout.tsx",
      "app/(public)/docs/page.tsx",
      "app/(auth)/layout.tsx",
      "app/(auth)/sign-in/page.tsx",
    ]) {
      expect(src(rel), rel).not.toContain("PilotBanner");
    }
    // The quiet pilot sentence on the sign-in screen is not the banner and stays.
    expect(src("app/(auth)/sign-in/page.tsx")).toMatch(/<PilotSignupNotice\s*\/>/);
  });

  it("is mounted nowhere outside the signed-in layout", () => {
    const root = path.resolve(__dirname, "../../..");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "__tests__" && entry.name !== "node_modules") walk(full);
        } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          const rel = path.relative(root, full);
          if (rel === "components/pilot/PilotBanner.tsx") continue;
          if (/<PilotBanner[\s/>]/.test(readFileSync(full, "utf8"))) offenders.push(rel);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([path.join("app", "(dashboard)", "layout.tsx")]);
  });
});
