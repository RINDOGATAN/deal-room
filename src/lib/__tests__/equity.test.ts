// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect } from "vitest";
import { validateEquity } from "../journey/equity";

describe("validateEquity", () => {
  it("accepts an empty list", () => {
    expect(validateEquity([])).toEqual({ valid: true });
  });

  it("accepts founders with no equity set", () => {
    expect(
      validateEquity([{ equityPercent: null }, { equityPercent: undefined }, { equityPercent: "" }]),
    ).toEqual({ valid: true });
  });

  it("accepts a 60/40 split summing to exactly 100", () => {
    expect(validateEquity([{ equityPercent: 60 }, { equityPercent: 40 }])).toEqual({ valid: true });
  });

  it("accepts string inputs equivalent to a valid split", () => {
    expect(validateEquity([{ equityPercent: "33.34" }, { equityPercent: "33.33" }, { equityPercent: "33.33" }])).toEqual({
      valid: true,
    });
  });

  it("accepts within tolerance (rounding error)", () => {
    expect(validateEquity([{ equityPercent: 33.34 }, { equityPercent: 33.33 }, { equityPercent: 33.33 }])).toEqual({
      valid: true,
    });
  });

  it("rejects a partial split (some set, some not)", () => {
    const result = validateEquity([{ equityPercent: 50 }, { equityPercent: null }]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("PARTIAL_EQUITY");
      expect(result.total).toBe(50);
    }
  });

  it("rejects a sum that doesn't reach 100", () => {
    const result = validateEquity([{ equityPercent: 30 }, { equityPercent: 30 }]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("DOES_NOT_SUM_TO_100");
      expect(result.total).toBe(60);
    }
  });

  it("rejects a sum over 100", () => {
    const result = validateEquity([{ equityPercent: 60 }, { equityPercent: 60 }]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("DOES_NOT_SUM_TO_100");
      expect(result.total).toBe(120);
    }
  });

  it("rejects beyond the 0.1 tolerance", () => {
    const result = validateEquity([{ equityPercent: 50 }, { equityPercent: 49.5 }]);
    expect(result.valid).toBe(false);
  });

  it("ignores NaN strings (treats them as unset)", () => {
    // 'abc' parses to NaN → treated as null → equivalent to "no equity" case
    expect(validateEquity([{ equityPercent: "abc" }, { equityPercent: "xyz" }])).toEqual({ valid: true });
  });
});
