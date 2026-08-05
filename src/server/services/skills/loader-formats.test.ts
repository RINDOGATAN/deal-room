// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect } from "vitest";
import { validateClausesFile } from "./loader";

/**
 * Authored skills vary along two INDEPENDENT axes: whether text is localised,
 * and whether pros/cons/bias are flat (prosPartyA) or nested (pros.partyA).
 * The loader once modelled these as a single either/or union — plain+flat vs
 * localised+nested — which rejected the two mixed combinations. Localised+flat
 * is the one real skills use most (the baked DPA, the whole residential
 * tenancy family), and every one of them failed here while passing the
 * packaging validator, which never coupled the axes.
 *
 * All four combinations must validate, and localised values must survive.
 */

const option = (over: Record<string, unknown>) => ({
  id: "o1", code: "o1", order: 1, ...over,
});

const file = (opts: Record<string, unknown>[]) => ({
  contractType: "TEST",
  displayName: "Test",
  version: "1.0",
  clauses: [
    {
      id: "c1", title: "C", category: "Cat", order: 1,
      plainDescription: "d", options: opts,
    },
  ],
});

const PLAIN_FLAT = option({
  label: "A", plainDescription: "d", legalText: "t",
  prosPartyA: ["p"], consPartyA: ["c"], prosPartyB: ["p"], consPartyB: ["c"],
  biasPartyA: 0.1, biasPartyB: -0.1,
});

const LOCALISED_FLAT = option({
  id: "o2", code: "o2", order: 2,
  label: { en: "A", es: "A" }, plainDescription: { en: "d", es: "d" },
  legalText: { en: "t", es: "t" },
  prosPartyA: { en: ["p"], es: ["p"] }, consPartyA: { en: ["c"], es: ["c"] },
  prosPartyB: { en: ["p"], es: ["p"] }, consPartyB: { en: ["c"], es: ["c"] },
  biasPartyA: 0.1, biasPartyB: -0.1,
});

const LOCALISED_NESTED = option({
  id: "o3", code: "o3", order: 3,
  label: { en: "A" }, plainDescription: { en: "d" }, legalText: { en: "t" },
  pros: { partyA: { en: ["p"] }, partyB: { en: ["p"] } },
  cons: { partyA: { en: ["c"] }, partyB: { en: ["c"] } },
  bias: { partyA: 0.1, partyB: -0.1 },
});

const PLAIN_NESTED = option({
  id: "o4", code: "o4", order: 4,
  label: "A", plainDescription: "d", legalText: "t",
  pros: { partyA: ["p"], partyB: ["p"] },
  cons: { partyA: ["c"], partyB: ["c"] },
  bias: { partyA: 0.1, partyB: -0.1 },
});

describe("loader: option format combinations", () => {
  it("accepts plain + flat (the historical 'legacy' shape)", () => {
    const r = validateClausesFile(file([PLAIN_FLAT, { ...PLAIN_FLAT, id: "x", code: "x", order: 2 }]));
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it("accepts localised + nested (the historical 'i18n' shape)", () => {
    const r = validateClausesFile(file([LOCALISED_NESTED, { ...LOCALISED_NESTED, id: "y", code: "y", order: 2 }]));
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it("accepts localised + flat — the shape DPA and the tenancy skills use", () => {
    const r = validateClausesFile(file([LOCALISED_FLAT, { ...LOCALISED_FLAT, id: "z", code: "z", order: 2 }]));
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it("accepts plain + nested", () => {
    const r = validateClausesFile(file([PLAIN_NESTED, { ...PLAIN_NESTED, id: "w", code: "w", order: 2 }]));
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it("accepts the two layouts mixed within one clause", () => {
    const r = validateClausesFile(file([LOCALISED_FLAT, LOCALISED_NESTED]));
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it("does not warn about pros/cons that are present but localised", () => {
    // The old getOptionArray only recognised a bare array as the flat layout,
    // so localised flat content fell through and was reported as missing.
    const r = validateClausesFile(file([LOCALISED_FLAT, { ...LOCALISED_FLAT, id: "z", code: "z", order: 2 }]));
    expect((r.warnings ?? []).filter((w) => /pros|cons/i.test(w))).toEqual([]);
  });

  it("still rejects a genuinely malformed option", () => {
    const bad = option({ label: "A", plainDescription: "d", legalText: "t" }); // no pros/cons/bias at all
    const r = validateClausesFile(file([bad, bad]));
    expect(r.valid).toBe(false);
    expect((r.errors ?? []).length).toBeGreaterThan(0);
  });

  it("still rejects an out-of-range bias in either layout", () => {
    const flat = { ...PLAIN_FLAT, biasPartyA: 5 };
    expect(validateClausesFile(file([flat, PLAIN_FLAT])).valid).toBe(false);
    const nested = { ...LOCALISED_NESTED, bias: { partyA: 5, partyB: 0 } };
    expect(validateClausesFile(file([nested, LOCALISED_NESTED])).valid).toBe(false);
  });
});
