// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The hosted pilot banner: present on hosted (both languages, with the
 * link to todo.law/run), absent on the kit, and mounted in the root layout
 * so it reaches every page.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
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

  it("is mounted in the root layout, so it is on every page", () => {
    const layout = readFileSync(
      path.resolve(__dirname, "../../../app/layout.tsx"),
      "utf8",
    );
    expect(layout).toContain('import { PilotBanner } from "@/components/pilot/PilotBanner"');
    expect(layout).toMatch(/<PilotBanner\s*\/>/);
  });
});
