// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it } from "vitest";
import { STATUTORY_DEADLINES, buildDeadlines, delawareDueDate, parseIsoDate } from "@/lib/statutory-deadlines";

describe("statutory deadlines", () => {
  it("counts 83(b) and Form D in calendar days from the dates given", () => {
    const { items } = buildDeadlines({ grantDate: "2026-12-15", firstSaleDate: "2026-02-20", today: new Date("2026-10-06T00:00:00Z") });
    const by = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(by["83B_ELECTION"].dueDate).toBe("2027-01-14");
    expect(by["FORM_D"].dueDate).toBe("2026-03-07");
    expect(by["DELAWARE_ANNUAL_REPORT"].dueDate).toBe("2027-03-01");
  });

  it("leaves a due date empty when its start date is not given", () => {
    const { items } = buildDeadlines({});
    expect(items.find((i) => i.id === "83B_ELECTION")!.dueDate).toBeNull();
    expect(items.find((i) => i.id === "FORM_D")!.dueDate).toBeNull();
  });

  it("gives the next 1 March, or the one of the year asked", () => {
    expect(delawareDueDate(new Date("2027-03-01T10:00:00Z"))).toBe("2027-03-01");
    expect(delawareDueDate(new Date("2027-03-02T00:00:00Z"))).toBe("2028-03-01");
    expect(delawareDueDate(new Date("2026-10-06T00:00:00Z"), 2030)).toBe("2030-03-01");
  });

  it("marks every item to verify, with an official source", () => {
    for (const locale of ["en", "es"] as const) {
      const { items, note } = buildDeadlines({ locale });
      expect(items).toHaveLength(3);
      for (const i of items) {
        expect(i.verify).toBe(locale === "es" ? "Compruébalo en la fuente oficial." : "Verify with the official source.");
        expect(i.source).toMatch(/^https:\/\/(www\.irs\.gov|www\.ecfr\.gov|corp\.delaware\.gov)\//);
        expect(`${i.title} ${i.rule}`).not.toMatch(/[–—]/);
      }
      expect(note).not.toMatch(/[–—]|you need|we recommend/);
    }
    expect(STATUTORY_DEADLINES.map((d) => d.days)).toEqual([30, 15, undefined]);
  });

  it("refuses dates that do not exist", () => {
    expect(parseIsoDate("2026-02-30")).toBeNull();
    expect(parseIsoDate("2026-2-3")).toBeNull();
    expect(parseIsoDate("2026-02-28")?.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });
});
