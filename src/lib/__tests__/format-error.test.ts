import { describe, it, expect } from "vitest";
import {
  formatUserError,
  isTransientDbError,
  TRANSIENT_MESSAGE,
} from "../format-error";

describe("isTransientDbError", () => {
  const transientCases = [
    "Control plane request failed",
    "connection timed out after 5s",
    "Connection terminated unexpectedly",
    "connect ECONNREFUSED 127.0.0.1:5432",
    "Can't reach database server at ep-foo.neon.tech",
    "the database system is starting up",
    "Too many connections",
    'neon:retryable":true}',
  ];

  for (const msg of transientCases) {
    it(`matches: "${msg.slice(0, 40)}..."`, () => {
      expect(isTransientDbError(new Error(msg))).toBe(true);
    });
  }

  it("returns false for unrelated errors", () => {
    expect(isTransientDbError(new Error("User not found"))).toBe(false);
    expect(isTransientDbError(new Error("Invalid input"))).toBe(false);
    expect(isTransientDbError(new Error(""))).toBe(false);
  });

  it("returns false for non-Error inputs", () => {
    expect(isTransientDbError("Control plane request failed")).toBe(false);
    expect(isTransientDbError(null)).toBe(false);
    expect(isTransientDbError(undefined)).toBe(false);
    expect(isTransientDbError({ message: "Control plane request failed" })).toBe(
      false,
    );
  });

  it("matches substrings anywhere in the message", () => {
    const wrapped = new Error(
      'Server error (HTTP status 500): {"message":"Control plane request failed","neon:retryable":true}',
    );
    expect(isTransientDbError(wrapped)).toBe(true);
  });
});

describe("formatUserError", () => {
  it("returns the transient message for transient DB errors", () => {
    expect(
      formatUserError(new Error("Control plane request failed"), "fallback"),
    ).toBe(TRANSIENT_MESSAGE);
    expect(
      formatUserError(
        new Error("connect ECONNREFUSED 127.0.0.1:5432"),
        "fallback",
      ),
    ).toBe(TRANSIENT_MESSAGE);
  });

  it("returns fallback for raw Prisma error stacks", () => {
    expect(
      formatUserError(
        new Error(
          "Invalid `prisma.user.findUnique()` invocation:\n\nsome details",
        ),
        "fallback",
      ),
    ).toBe("fallback");
    expect(
      formatUserError(
        new Error("PrismaClientInitializationError: ..."),
        "fallback",
      ),
    ).toBe("fallback");
    expect(
      formatUserError(
        new Error("PrismaClientKnownRequestError: ..."),
        "fallback",
      ),
    ).toBe("fallback");
  });

  it("returns the original message for regular user-safe errors", () => {
    expect(formatUserError(new Error("Email already in use"), "fallback")).toBe(
      "Email already in use",
    );
  });

  it("returns fallback for non-Error inputs", () => {
    expect(formatUserError(null, "fallback")).toBe("fallback");
    expect(formatUserError(undefined, "fallback")).toBe("fallback");
    expect(formatUserError("a string", "fallback")).toBe("fallback");
    expect(formatUserError({ message: "not real" }, "fallback")).toBe(
      "fallback",
    );
  });

  it("returns fallback when Error has no message", () => {
    expect(formatUserError(new Error(""), "fallback")).toBe("fallback");
  });

  it("TRANSIENT_MESSAGE is a user-safe, non-empty string", () => {
    expect(typeof TRANSIENT_MESSAGE).toBe("string");
    expect(TRANSIENT_MESSAGE.length).toBeGreaterThan(0);
    expect(TRANSIENT_MESSAGE).not.toContain("Control plane");
    expect(TRANSIENT_MESSAGE).not.toContain("neon");
    expect(TRANSIENT_MESSAGE).not.toContain("Prisma");
  });
});
