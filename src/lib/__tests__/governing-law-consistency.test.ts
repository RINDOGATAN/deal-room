// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A contract type's governing laws must be exactly the jurisdictions its
 * skill's metadata names: a tag must never be shown as another law (the
 * Delaware Certificate of Incorporation was once listed as CALIFORNIA).
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SKILL_JURISDICTION_TO_GOVERNING_LAW,
  journeyGoverningLaw,
} from "@/lib/jurisdictions";
import { governingLawsFor } from "@/server/services/agent/contractTypes";
import snapshot from "@/lib/agent-contract-types.json";

const skillsDir = join(process.cwd(), "skills");
const skills = readdirSync(skillsDir)
  .filter((d) => existsSync(join(skillsDir, d, "metadata.json")))
  .map((d) => JSON.parse(readFileSync(join(skillsDir, d, "metadata.json"), "utf8")) as {
    contractType: string;
    jurisdictions: string[];
  });

describe("governing laws match skill jurisdictions", () => {
  it("maps every jurisdiction tag to itself", () => {
    for (const [tag, law] of Object.entries(SKILL_JURISDICTION_TO_GOVERNING_LAW)) {
      expect(law, tag).toBe(tag);
    }
  });

  it("offers every skill exactly the laws its metadata names", () => {
    expect(skills.length).toBeGreaterThan(0);
    for (const s of skills) {
      expect(governingLawsFor(s.jurisdictions), s.contractType).toEqual(s.jurisdictions);
    }
  });

  it("lists the snapshot's governing laws as the skill metadata names them", () => {
    const byType = new Map(snapshot.contractTypes.map((t) => [t.contractType, t.governingLaws]));
    for (const s of skills) {
      const laws = byType.get(s.contractType);
      if (laws) expect([...laws].sort(), s.contractType).toEqual([...s.jurisdictions].sort());
    }
  });

  it("offers the Delaware Certificate of Incorporation under DELAWARE, never CALIFORNIA", () => {
    const t = snapshot.contractTypes.find((c) => c.contractType === "DELAWARE_CERT_OF_INCORPORATION");
    expect(t?.governingLaws).toEqual(["DELAWARE"]);
    expect(t?.governingLaws).not.toContain("CALIFORNIA");
    expect(governingLawsFor(["DELAWARE"])).toEqual(["DELAWARE"]);
    expect(journeyGoverningLaw(["DELAWARE"])).toBe("DELAWARE");
    expect(journeyGoverningLaw(["CALIFORNIA", "ENGLAND_WALES"])).toBe("CALIFORNIA");
    expect(journeyGoverningLaw([])).toBe("CALIFORNIA");
  });
});
