// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The safeguards guide on the Dealroom home: the level table, three ways in both
 * languages, the way names equal to the hosting boxes, and the copy rules (no prices,
 * no long dashes, no "no certification" lines, no test-pilot wording: Dealroom's cloud
 * is its paid public service).
 */
import { describe, it, expect } from "vitest";
import { COPY, LADDER, WAY_CARD, levelOf, pickWay, recommend, type Answers, type Locale } from "./safeguards";
import en from "../i18n/en/dealroom-startups.json";
import es from "../i18n/es/dealroom-startups.json";

const LOCALES: Locale[] = ["en", "es"];
const DICT: Record<Locale, Record<string, string>> = { en, es };

const ROWS: [keyof Answers, string, number][] = [
  ["loc", "any", 0],
  ["loc", "servers", 2],
  ["data", "test", 0],
  ["data", "real", 0],
  ["data", "special", 1],
  ["ai", "none", 0],
  ["ai", "ext", 0],
  ["ai", "key", 1],
  ["ai", "local", 1],
  ["iso", "yes", 1],
  ["iso", "no", 0],
  ["it", "yes", 0],
  ["it", "no", 0],
  ["cert", "yes", 2],
  ["cert", "no", 0],
];

describe.each(LOCALES)("Dealroom safeguards guide (%s)", (locale) => {
  it.each(ROWS)("%s = %s sets level %i", (q, v, level) => {
    expect(levelOf({ [q]: v }, locale)).toBe(level);
  });

  it("sends real contracts to the cloud, special data to managed, own servers to own hardware", () => {
    expect(pickWay({ data: "real" }, locale)).toBe("cloud");
    expect(pickWay({ data: "special" }, locale)).toBe("managed");
    expect(pickWay({ loc: "servers" }, locale)).toBe("deploy");
    expect(recommend({}, locale)).toBeNull();
    expect(recommend({ data: "real" }, locale)?.checks).toEqual([{ key: "data:real", met: true }]);
  });

  it("offers three ways, named as the hosting boxes", () => {
    expect(LADDER[locale]).toEqual(["cloud", "managed", "deploy"]);
    const names = (["cloud", "managed", "deploy"] as const).map((w) => DICT[locale][`${locale}.ways.w${WAY_CARD[locale][w]}.title`]);
    expect(names).toEqual(
      locale === "en"
        ? ["In the TODO.LAW cloud", "Managed virtual server", "Your own hardware"]
        : ["En la nube de TODO.LAW", "Servidor virtual gestionado", "Tu propio hardware"],
    );
  });

  it("keeps the copy rules", () => {
    const text = JSON.stringify(COPY[locale]) + Object.entries(DICT[locale]).filter(([k]) => k.startsWith(`${locale}.ways.`)).map(([, v]) => v).join(" ");
    expect(text).not.toMatch(/[$€]\s?\d|\d\s?[$€]|USD|EUR\b/);
    expect(text).not.toMatch(/—|–/);
    expect(text).not.toMatch(/no independent certification|without certification|sin certificación|no tenemos certificación/i);
    expect(text).not.toMatch(/pilot|piloto|six weeks|seis semanas|runbook|manual de operación/i);
  });
});
