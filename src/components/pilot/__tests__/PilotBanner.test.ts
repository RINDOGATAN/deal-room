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
    expect(html).toContain("Hosted pilot: free, capped, no security certification.");
    expect(html).toContain("For real client data,");
    expect(html).toContain('href="https://www.todo.law/run"');
    expect(html).toContain("run your own instance");
    // Dismissible.
    expect(html).toContain('aria-label="Dismiss"');
  });

  it("speaks Castilian Spanish with tú", () => {
    const html = render(true, "es");
    expect(html).toContain("Piloto alojado: gratuito, con límites y sin certificación de seguridad.");
    expect(html).toContain("ejecuta tu propia instancia");
    expect(html).toContain('href="https://www.todo.law/run"');
    expect(html).toContain('aria-label="Cerrar"');
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
