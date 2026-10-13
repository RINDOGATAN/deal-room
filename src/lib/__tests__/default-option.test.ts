// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defaultOption } from "../default-option";

type SkillOption = { code: string; order: number; label?: unknown; biasPartyA?: number; biasPartyB?: number };
type SkillClause = { id: string; isRequired?: boolean; options: SkillOption[] };

const asRow = (o: SkillOption) => ({
  ...o,
  label: typeof o.label === "string" ? o.label : (o.label as Record<string, string> | undefined)?.en,
});
function readSkill(name: string): SkillClause[] {
  return JSON.parse(readFileSync(resolve(process.cwd(), `skills/${name}/clauses.json`), "utf8")).clauses;
}

describe("defaultOption", () => {
  it("NDA: an omitted clause takes the middle ground of the guide, never the first option", () => {
    const picked = Object.fromEntries(
      readSkill("nda").map((c) => [c.id, defaultOption(c.options.map(asRow), { isRequired: c.isRequired })?.code]),
    );
    expect(picked).toEqual({
      "confidentiality-duration": "3-years",
      "permitted-disclosures": "standard",
      "confidential-info-definition": "standard",
      "return-destruction": "standard-archive",
      "dispute-resolution": "courts-default",
      remedies: "balanced",
      "agreement-term": "2-years",
      "non-solicitation": "none",
      assignment: "affiliate-only",
    });
  });

  it("prefers a standard option among equally neutral ones, then the lowest order", () => {
    const o = (code: string, order: number, bias = 0) => ({ code, order, biasPartyA: bias, biasPartyB: -bias });
    expect(defaultOption([o("a", 1), o("standard", 2)])?.code).toBe("standard");
    expect(defaultOption([o("a", 1, 0.4), o("b", 2), o("c", 3)])?.code).toBe("b");
    expect(defaultOption([o("strict", 1, 0.4), o("loose", 2, 0.1)])?.code).toBe("loose");
    expect(defaultOption([o("long", 1, 0.3), o("none", 2, -0.2)], { isRequired: false })?.code).toBe("none");
    expect(defaultOption([])).toBeUndefined();
  });

  it("every built-in skill clause with options has a default", () => {
    const dir = resolve(process.cwd(), "skills");
    for (const name of readdirSync(dir)) {
      if (!existsSync(resolve(dir, name, "clauses.json"))) continue;
      for (const c of readSkill(name)) {
        if (!c.options?.length) continue;
        expect(defaultOption(c.options.map(asRow), { isRequired: c.isRequired }), `${name}/${c.id}`).toBeDefined();
      }
    }
  });
});
