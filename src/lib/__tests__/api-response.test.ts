// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiError } from "../api-response";
import { TRANSIENT_MESSAGE } from "../format-error";

// Hoisted above the imports: the structured logger (@/lib/logger) captures
// its console sinks at module-initialisation time, so the spy must be
// installed before api-response (and the logger) are loaded — a spy created
// in beforeEach would never see the logger's calls.
const consoleErrorSpy = vi.hoisted(() =>
  vi.spyOn(console, "error").mockImplementation(() => {}),
);

describe("apiError", () => {
  beforeEach(() => {
    consoleErrorSpy.mockClear();
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
    // apiError now logs through the structured logger (scope "api"), which
    // still sinks to console.error. Assert format-agnostically: one call,
    // carrying both the scope (JSON `"scope":"api"` server-side or "[api]"
    // browser-side) and the original error text.
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const logged = consoleErrorSpy.mock.calls[0].map(String).join(" ");
    expect(logged).toMatch(/"scope":"api"|\[api\]/);
    expect(logged).toContain("Control plane request failed");
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
