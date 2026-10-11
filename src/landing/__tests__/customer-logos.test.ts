// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The customer logos on the landing ("Trusted by", 11 Oct 2026): ten clean, small files, each
 * with its name as alt text and its own size (no layout shift), loaded lazily, under a
 * heading in each language.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CustomerLogos from "../components/CustomerLogos";
import { CUSTOMER_LOGOS } from "../config/customer-logos";
import en from "../i18n/en/dealroom-startups.json";
import es from "../i18n/es/dealroom-startups.json";

const ROOT = path.resolve(__dirname, "../../..");

describe("customer logos", () => {
  it("list the ten organizations, each with a clean file and a size", () => {
    expect(CUSTOMER_LOGOS).toHaveLength(10);
    for (const l of CUSTOMER_LOGOS) {
      const file = path.join(ROOT, "public", l.src);
      expect(existsSync(file), l.src).toBe(true);
      expect(statSync(file).size, l.src).toBeLessThan(20_000);
      if (l.src.endsWith(".svg")) expect(readFileSync(file, "utf8")).not.toMatch(/<script|href=|<image|<foreignObject|\son[a-z]+=/i);
    }
  });

  it("carry the heading in both languages", () => {
    expect(en["logos.label"]).toBe("Trusted by");
    expect(es["logos.label"]).toBe("Clientes destacados");
  });

  it("render sized, lazy images with alt text, and nothing for an empty list", () => {
    const html = renderToStaticMarkup(createElement(CustomerLogos, { label: en["logos.label"] }));
    expect(html.match(/<img /g)).toHaveLength(10);
    expect(html.match(/loading="lazy"/g)).toHaveLength(10);
    expect(html.match(/width="\d+" height="\d+"/g)).toHaveLength(10);
    expect(html).toContain('alt="Whole Foods Market"');
    // Muted by default, own colours on hover (Tailwind 4 applies hover: only where hover exists).
    expect(html.match(/brightness-0 invert opacity-60 [^"]*hover:filter-none hover:opacity-100/g)).toHaveLength(10);
    expect(renderToStaticMarkup(createElement(CustomerLogos, { label: "x", logos: [] }))).toBe("");
  });
});
