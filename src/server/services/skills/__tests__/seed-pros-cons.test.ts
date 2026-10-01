// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  optionProsCons,
  type LocalizedArray,
  type ProsConsSource,
} from "../../../../../prisma/option-pros-cons";

// The four built-in skills that author pros and cons in the nested layout
// (pros.partyA, cons.partyB). The seed once read only the flat fields, so all
// of their options reached the database with empty pros and cons.
const NESTED_SKILLS = ["nda", "msa", "saas", "delaware-certificate-of-incorporation"];
const FIELDS = ["prosPartyA", "consPartyA", "prosPartyB", "consPartyB"] as const;

type Option = ProsConsSource & { id: string };

function loadOptions(skill: string): Option[] {
  const file = path.join(__dirname, "../../../../../skills", skill, "clauses.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as {
    clauses: { options: Option[] }[];
  };
  return data.clauses.flatMap((c) => c.options);
}

// What the seed stores in the flat column: the English list.
function seededList(value: LocalizedArray | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value.en || Object.values(value)[0] || [];
}

function authored(option: Option, field: (typeof FIELDS)[number]): boolean {
  const party = field.endsWith("A") ? "partyA" : "partyB";
  const group = field.startsWith("pros") ? option.pros : option.cons;
  return (group?.[party] ?? option[field]) !== undefined;
}

describe("seed reads pros and cons in both layouts", () => {
  for (const skill of NESTED_SKILLS) {
    it(`${skill}: no authored option is seeded with empty pros or cons`, () => {
      const options = loadOptions(skill);
      expect(options.length).toBeGreaterThan(0);
      const empty: string[] = [];
      for (const option of options) {
        const pc = optionProsCons(option);
        for (const field of FIELDS) {
          if (authored(option, field) && seededList(pc[field]).length === 0) {
            empty.push(`${option.id}.${field}`);
          }
        }
      }
      expect(empty).toEqual([]);
    });
  }

  it("prefers the nested layout and falls back to the flat one", () => {
    expect(
      optionProsCons({ pros: { partyA: ["nested"] }, prosPartyA: ["flat"] }).prosPartyA,
    ).toEqual(["nested"]);
    expect(optionProsCons({ consPartyB: { en: ["flat"] } }).consPartyB).toEqual({
      en: ["flat"],
    });
    expect(optionProsCons({}).prosPartyB).toBeUndefined();
  });
});
