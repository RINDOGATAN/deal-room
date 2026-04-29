import { describe, it, expect } from "vitest";
import { computeBucket } from "@/server/middleware/apiKeyAuth";

describe("computeBucket", () => {
  const HOUR = 3600_000;
  const WEEK = 7 * 24 * HOUR;

  it("rounds down to the start of the current hour", () => {
    // 2026-04-29T14:37:42.000Z = 1777819062000
    const t = Date.UTC(2026, 3, 29, 14, 37, 42);
    const { windowStart, expiresAt } = computeBucket(t, HOUR);
    expect(windowStart).toBe(Date.UTC(2026, 3, 29, 14, 0, 0));
    expect(expiresAt.getTime()).toBe(Date.UTC(2026, 3, 29, 15, 0, 0));
  });

  it("returns the same bucket for two timestamps in the same hour", () => {
    const a = Date.UTC(2026, 3, 29, 14, 0, 0);
    const b = Date.UTC(2026, 3, 29, 14, 59, 59);
    expect(computeBucket(a, HOUR).windowStart).toBe(
      computeBucket(b, HOUR).windowStart,
    );
  });

  it("returns different buckets across an hour boundary", () => {
    const a = Date.UTC(2026, 3, 29, 14, 59, 59);
    const b = Date.UTC(2026, 3, 29, 15, 0, 0);
    expect(computeBucket(a, HOUR).windowStart).not.toBe(
      computeBucket(b, HOUR).windowStart,
    );
  });

  it("handles weekly windows", () => {
    const t = Date.UTC(2026, 3, 29, 14, 37, 42);
    const { windowStart, expiresAt } = computeBucket(t, WEEK);
    // The exact week-start is deterministic from epoch (no timezone weirdness
    // since we're working in ms-since-epoch). Just verify the invariants.
    expect(windowStart).toBeLessThanOrEqual(t);
    expect(t).toBeLessThan(expiresAt.getTime());
    expect(expiresAt.getTime() - windowStart).toBe(WEEK);
  });

  it("expiresAt is exactly windowStart + windowMs", () => {
    const t = Date.now();
    const { windowStart, expiresAt } = computeBucket(t, HOUR);
    expect(expiresAt.getTime() - windowStart).toBe(HOUR);
  });
});
