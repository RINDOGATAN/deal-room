// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The NDA's one-way / mutual switch (parameter nda-type, boilerplate
 * conditionalVariables). One-way, the default, must print exactly the text
 * the template printed before the switch existed, except California (b)
 * under the "balanced" remedies option, where the no-bond injunction is now
 * available to either party. Mutual rewrites the title, preamble,
 * background, the two party definitions, the obligations lead, the party
 * labels and California (b).
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@/lib/prisma", () => ({ default: {} }));

import { processBoilerplate } from "./generator";
import { buildBoilerplateVariables, type ParameterSchema } from "@/lib/parameters";

const read = (p: string) => JSON.parse(readFileSync(resolve(process.cwd(), p), "utf8"));
const current = read("skills/nda/boilerplate.json");
const before = read("src/server/services/document/fixtures/nda-boilerplate-one-way-before-mutual.json");
const params = read("skills/nda/parameters.json") as ParameterSchema;

const BASE = {
  effectiveDate: "October 13, 2026",
  partyAName: "Demo Company A",
  partyBName: "Demo Supplier B",
  partyAAddress: "[Address]",
  partyBAddress: "Calle Mayor 1, 28013 Madrid, Spain",
  partyASignatureBlock: "A-BLOCK",
  partyBSignatureBlock: "B-BLOCK",
};

function vars(ndaType: string | undefined, remedies: string) {
  const dealParams: Record<string, string> = ndaType ? { "nda-type": ndaType } : {};
  return { ...BASE, ...buildBoilerplateVariables(dealParams, params), "clause.remedies": remedies };
}

const LAWS = ["CALIFORNIA", "ENGLAND_WALES", "SPAIN"];
const LANGS = ["en", "es"];

describe("NDA one-way (default)", () => {
  for (const law of LAWS)
    for (const lang of LANGS)
      for (const remedies of ["standard", "enhanced"]) {
        it(`${law} ${lang} ${remedies}: identical to the template before the switch`, () => {
          const v = vars(undefined, remedies);
          expect(processBoilerplate(current, law, v, lang)).toEqual({
            ...processBoilerplate(before, law, v, lang),
          });
        });
      }

  it("balanced remedies: only California (b) changes, to either party", () => {
    for (const lang of LANGS) {
      const v = vars("one-way", "balanced");
      const now = processBoilerplate(current, "CALIFORNIA", v, lang)!;
      const was = processBoilerplate(before, "CALIFORNIA", v, lang)!;
      expect({ ...now, jurisdictionProvision: null }).toEqual({ ...was, jurisdictionProvision: null });
      expect(now.jurisdictionProvision!.text).not.toEqual(was.jurisdictionProvision!.text);
      expect(now.jurisdictionProvision!.text).toContain(
        lang === "en" ? "either party shall be entitled to seek injunctive" : "cualquiera de las partes tendrá derecho a solicitar medidas cautelares",
      );
      for (const law of ["ENGLAND_WALES", "SPAIN"]) {
        expect(processBoilerplate(current, law, v, lang)).toEqual(processBoilerplate(before, law, v, lang));
      }
    }
  });
});

describe("NDA mutual", () => {
  const en = processBoilerplate(current, "CALIFORNIA", vars("mutual", "standard"), "en")!;
  const es = processBoilerplate(current, "CALIFORNIA", vars("mutual", "balanced"), "es")!;

  it("names both parties as Party A and Party B, and defines the roles per disclosure", () => {
    expect(en.contractTitle).toBe("MUTUAL NON-DISCLOSURE AGREEMENT");
    expect(en.preamble).toContain('Demo Company A, with its principal place of business at [Address] ("Party A")');
    expect(en.preamble).toContain('("Party B")');
    expect(en.preamble).not.toContain("DISCLOSING PARTY");
    expect(en.partyLabels).toEqual({ partyA: "Party A", partyB: "Party B" });
    const def = en.definitions.find((d) => d.term === "Disclosing Party")!.definition;
    expect(def).toContain("Each party is the Disclosing Party with respect to the Confidential Information it discloses.");
    expect(en.background).toContain("WHEREAS each party possesses");
    expect(en.standardClauses.find((c) => c.title === "Confidentiality obligations")!.text).toMatch(
      /^Each party, as Receiving Party, shall, with respect to the Confidential Information of the other party:/,
    );
    expect(en.jurisdictionProvision!.text).toContain("each party, as Disclosing Party with respect to its own Confidential Information, shall be entitled");
  });

  it("Spanish", () => {
    expect(es.contractTitle).toBe("ACUERDO DE CONFIDENCIALIDAD MUTUO");
    expect(es.partyLabels).toEqual({ partyA: "Parte A", partyB: "Parte B" });
    expect(es.preamble).toContain('(la "Parte A")');
    expect(es.jurisdictionProvision!.text).toContain("cada parte, en su condición de Parte Divulgante respecto de su propia Información Confidencial, tendrá derecho");
  });

  it("leaves no unresolved variable in any text", () => {
    for (const law of LAWS)
      for (const lang of LANGS)
        for (const t of ["one-way", "mutual"]) {
          const out = JSON.stringify(processBoilerplate(current, law, vars(t, "balanced"), lang));
          expect(out, `${law} ${lang} ${t}`).not.toMatch(/\{nda[A-Za-z]+\}/);
        }
  });
});
