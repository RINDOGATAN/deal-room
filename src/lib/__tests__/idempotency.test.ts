import { describe, it, expect } from "vitest";
import { validateIdempotencyKey, IDEMPOTENCY_TTL_MS } from "@/server/middleware/idempotency";

describe("validateIdempotencyKey", () => {
  it("accepts a normal opaque token", () => {
    expect(validateIdempotencyKey("abc123")).toEqual({ valid: true, key: "abc123" });
  });

  it("accepts UUIDs and dashed keys", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    expect(validateIdempotencyKey(uuid)).toEqual({ valid: true, key: uuid });
  });

  it("accepts underscores", () => {
    expect(validateIdempotencyKey("retry_attempt_4")).toEqual({
      valid: true,
      key: "retry_attempt_4",
    });
  });

  it("rejects keys over 200 chars", () => {
    const long = "a".repeat(201);
    expect(validateIdempotencyKey(long)).toEqual({ valid: false, reason: "TOO_LONG" });
  });

  it("rejects keys with spaces", () => {
    expect(validateIdempotencyKey("has space")).toEqual({
      valid: false,
      reason: "INVALID_CHARS",
    });
  });

  it("rejects keys with shell metacharacters", () => {
    // Defensive: prevent shenanigans if a key ever ends up in a log/path
    expect(validateIdempotencyKey("$(rm -rf /)").valid).toBe(false);
    expect(validateIdempotencyKey("a;b").valid).toBe(false);
    expect(validateIdempotencyKey("a/b").valid).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateIdempotencyKey("").valid).toBe(false);
  });
});

describe("IDEMPOTENCY_TTL_MS", () => {
  it("is 24 hours", () => {
    expect(IDEMPOTENCY_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });
});
