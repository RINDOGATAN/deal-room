// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { interpolateParameters, type ParameterSchema } from "@/lib/parameters";

/**
 * Content guards for the built-in skills in `skills/`. They catch defects that
 * check:skills does not see because they are about what the finished
 * document says, not about the JSON shape.
 */

const SKILLS = join(process.cwd(), "skills");

type I18n = Record<string, string>;
interface Option {
  id: string;
  legalText: I18n;
  label: I18n;
  plainDescription: I18n;
  biasPartyA?: number;
  biasPartyB?: number;
  bias?: { partyA: number; partyB: number };
}
interface Clause {
  id: string;
  options: Option[];
}

const read = <T,>(skill: string, file: string): T =>
  JSON.parse(readFileSync(join(SKILLS, skill, file), "utf8")) as T;

const skills = readdirSync(SKILLS).filter((d) => existsSync(join(SKILLS, d, "clauses.json")));

describe("option bias has one source of truth", () => {
  it.each(skills)("%s: every option has biasPartyA/biasPartyB and no disagreeing nested bias", (skill) => {
    const { clauses } = read<{ clauses: Clause[] }>(skill, "clauses.json");
    for (const clause of clauses) {
      for (const o of clause.options) {
        expect(typeof o.biasPartyA, `${clause.id}/${o.id}`).toBe("number");
        expect(typeof o.biasPartyB, `${clause.id}/${o.id}`).toBe("number");
        if (o.bias) {
          expect(o.bias, `${clause.id}/${o.id}`).toEqual({ partyA: o.biasPartyA, partyB: o.biasPartyB });
        }
      }
    }
  });
});

describe("privacy notice: the privacy contact is filled in", () => {
  const { clauses } = read<{ clauses: Clause[] }>("privacy-notice", "clauses.json");
  const schema = read<ParameterSchema>("privacy-notice", "parameters.json");
  const params = {
    "company-name": "Example Ltd",
    "company-website": "https://example.com",
    "dpo-email": "privacy@example.com",
    "effective-date": "2026-10-01",
  };

  it.each(["en", "es"])("leaves no bracketed placeholder in any option (%s)", (lang) => {
    let filled = 0;
    for (const clause of clauses) {
      for (const o of clause.options) {
        const text = interpolateParameters(o.legalText[lang], params, schema, clause.id, lang);
        expect(text, `${clause.id}/${o.id}`).not.toMatch(/\[[^\]]*[A-Za-z][^\]]*\]/);
        if (text.includes("privacy@example.com")) filled++;
      }
    }
    expect(filled).toBeGreaterThan(0);
  });
});

describe("MSA: the document never contradicts itself", () => {
  const boilerplate = JSON.stringify(read("msa", "boilerplate.json"));
  const { clauses } = read<{ clauses: Clause[] }>("msa", "clauses.json");

  it("leaves the confidentiality survival period to the negotiated Confidentiality duration", () => {
    expect(boilerplate).not.toMatch(/three \(3\) years|tres \(3\) años/);
    expect(boilerplate).toContain("Confidentiality Duration");
    expect(boilerplate).toContain("Duración de la confidencialidad");
  });

  it("states no amount in US dollars; amounts are in the Contract Currency of the governing law", () => {
    for (const clause of clauses) {
      for (const o of clause.options) {
        for (const field of [o.legalText, o.label, o.plainDescription]) {
          for (const text of Object.values(field)) expect(text, `${clause.id}/${o.id}`).not.toMatch(/\$/);
        }
      }
    }
    const provisions = read<{ jurisdictionProvisions: Record<string, { text: I18n }> }>(
      "msa",
      "boilerplate.json",
    ).jurisdictionProvisions;
    expect(provisions.CALIFORNIA.text.en).toContain("Contract Currency\" is the United States dollar");
    expect(provisions.SPAIN.text.en).toContain("Contract Currency\" is the euro");
    expect(provisions.ENGLAND_WALES.text.en).toContain("Contract Currency\" is the pound sterling");
    expect(provisions.SPAIN.text.es).toContain("Moneda del Contrato\" es el euro");
  });
});
