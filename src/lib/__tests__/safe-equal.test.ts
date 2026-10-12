// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC
import { describe, it, expect } from "vitest";
import { safeEqual } from "@/lib/safe-equal";

describe("safeEqual", () => {
  it("matches equal strings", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
  });
  it("refuses different strings of the same and of different lengths", () => {
    expect(safeEqual("abc123", "abc124")).toBe(false);
    expect(safeEqual("abc", "abc123")).toBe(false);
  });
  it("never matches an empty or missing value", () => {
    expect(safeEqual("", "")).toBe(false);
    expect(safeEqual(undefined, undefined)).toBe(false);
    expect(safeEqual("x", undefined)).toBe(false);
    expect(safeEqual(null, "x")).toBe(false);
  });
});
