// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * find_template: deterministic matching of a described matter against the
 * contract guides, time-sensitive matters flagged, gaps named, and the
 * fixed answer when nothing fits (owner's decision T3, 6 October 2026).
 */
import { describe, expect, it } from "vitest";
import { FIND_TEMPLATE_TEXT, findTemplates } from "@/lib/find-template";
import { findableContracts, findTemplateAnswer } from "@/server/services/agent/coverage";

const en = findableContracts("en");
const es = findableContracts("es");
const codes = (q: string, lang: "en" | "es" = "en") =>
  findTemplates(q, lang === "es" ? es : en, lang).matches.map((m) => m.contractType);

describe("find_template", () => {
  it("finds a contract by its code, alias or name, in English and Spanish", () => {
    expect(codes("nda")[0]).toBe("NDA");
    expect(codes("We need a non-disclosure agreement with a supplier")[0]).toBe("NDA");
    expect(codes("contrato de confidencialidad con un proveedor", "es")[0]).toBe("NDA");
    expect(codes("we are hiring a freelancer for design work")).toContain("CONSULTING");
    expect(codes("a data processing agreement for our SaaS vendor")).toContain("DPA");
    expect(codes("raising money on a SAFE")).toContain("SAFE");
  });

  it("answers with the fixed sentence when nothing fits", () => {
    const r = findTemplates("we want to adopt a cat", en, "en");
    expect(r.matches).toEqual([]);
    expect(r.message).toBe("No template covers this. Such matters are usually handled by a lawyer.");
    expect(findTemplates("queremos adoptar un gato", es, "es").message).toBe(FIND_TEMPLATE_TEXT.noTemplate.es);
  });

  it("flags the time-sensitive matters as outside the templates", () => {
    const cases: [string, string][] = [
      ["We received a subpoena from a court in Texas", "SUBPOENA"],
      ["we were sued by a former contractor", "LAWSUIT_OR_CLAIM"],
      ["we had a data breach last night", "DATA_BREACH"],
      ["a letter from the regulator arrived about cookies", "REGULATOR_LETTER"],
      ["nos han demandado", "LAWSUIT_OR_CLAIM"],
      ["hemos sufrido una brecha de datos", "DATA_BREACH"],
    ];
    for (const [q, cat] of cases) {
      const r = findTemplates(q, en, "en");
      expect(r.timeSensitive, q).toContain(cat);
    }
    const r = findTemplates("We received a subpoena", en, "en");
    expect(r.matches).toEqual([]);
    expect(r.message).toBe(
      "The description mentions a subpoena: a time-sensitive matter that is outside the templates. No template covers this. Such matters are usually handled by a lawyer.",
    );
  });

  it("does not let the flagged words pick a template", () => {
    // "data" alone would match the DPA; inside "data breach" it does not.
    expect(codes("we had a data breach")).toEqual([]);
  });

  it("names documents with no template yet instead of a near alias", () => {
    const r = findTemplates("terms of service for our app", en, "en");
    expect(r.matches.map((m) => m.contractType)).not.toContain("SAAS");
    expect(r.notYetCovered).toEqual(["Terms of Service"]);
    expect(r.message).toBe(
      "Dealroom has no template yet for: Terms of Service. No template covers this. Such matters are usually handled by a lawyer.",
    );
    expect(findTemplates("bylaws and a board consent", en, "en").notYetCovered).toEqual(["bylaws", "board consents"]);
  });

  it("never says what the user needs and never names a lawyer", () => {
    for (const q of ["nda", "subpoena", "bylaws", "adopt a cat", "terms of service and an nda"]) {
      for (const lang of ["en", "es"] as const) {
        const m = findTemplates(q, lang === "es" ? es : en, lang).message;
        expect(m).not.toMatch(/you need|we recommend|necesitas|te recomendamos/i);
        expect(m).not.toMatch(/[–—]/);
      }
    }
  });

  it("is deterministic and gives guide links", () => {
    const a = findTemplateAnswer("mutual nda", "en");
    expect(findTemplateAnswer("mutual nda", "en")).toEqual(a);
    expect(a.matches[0]).toMatchObject({
      contractType: "NDA",
      guide: "https://dealroom.todo.law/contracts/nda",
      agentExample: "https://dealroom.todo.law/contracts/nda#agent",
    });
    expect(findTemplateAnswer("nda", "es").matches[0].guide).toBe("https://dealroom.todo.law/es/contracts/nda");
  });
});
