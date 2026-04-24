import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiError } from "../api-response";
import { TRANSIENT_MESSAGE } from "../format-error";

describe("apiError", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns 503 + friendly message for Neon control-plane errors", async () => {
    const err = new Error(
      'Server error (HTTP status 500): {"message":"Control plane request failed","neon:retryable":true}',
    );
    const res = apiError(err, "Feedback could not be sent");
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: TRANSIENT_MESSAGE });
  });

  it("returns 503 for each transient pattern", async () => {
    const messages = [
      "connection timed out",
      "Connection terminated unexpectedly",
      "connect ECONNREFUSED",
      "Too many connections",
      "Can't reach database server",
      "the database system is starting up",
    ];
    for (const msg of messages) {
      const res = apiError(new Error(msg), "fallback");
      expect(res.status, `status for "${msg}"`).toBe(503);
      const body = await res.json();
      expect(body.error, `body for "${msg}"`).toBe(TRANSIENT_MESSAGE);
    }
  });

  it("returns 500 + fallback for Prisma stack traces", async () => {
    const err = new Error(
      "PrismaClientInitializationError: Can't load schema",
    );
    const res = apiError(err, "Failed to generate PDF");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Failed to generate PDF" });
  });

  it("returns 500 + original message for user-safe errors", async () => {
    const res = apiError(new Error("Invalid skillId"), "fallback");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Invalid skillId" });
  });

  it("returns 500 + fallback for non-Error values", async () => {
    const res = apiError("some string thrown", "Something broke");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Something broke" });
  });

  it("logs the raw error server-side for observability", () => {
    const err = new Error("Control plane request failed");
    apiError(err, "fallback");
    expect(consoleErrorSpy).toHaveBeenCalledWith("[api]", err);
  });

  it("uses default fallback when none provided", async () => {
    const res = apiError(new Error(""));
    const body = await res.json();
    expect(body.error).toMatch(/unexpected error/i);
  });

  it("response is valid JSON with Content-Type: application/json", async () => {
    const res = apiError(new Error("boom"), "fallback");
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
