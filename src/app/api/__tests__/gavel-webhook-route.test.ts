// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Route tests for the inbound Gavel webhook (POST /api/webhooks/gavel).
 *
 * Contracts pinned here:
 *   1. A call signed with `sha256=<HMAC-SHA256(body, GAVEL_WEBHOOK_SECRET)>`
 *      in `x-gavel-signature` is accepted and applied to the dispute.
 *   2. An unsigned call, or one signed with the wrong secret or over a
 *      different body, is refused with 401 and nothing is read or written.
 *   3. With GAVEL_WEBHOOK_SECRET unset the route fails closed with 503,
 *      even for a call that would otherwise be valid.
 *
 * The route reads the secret when the module loads, so each test sets the
 * variable and then imports a fresh copy of the route.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "crypto";

// --- Mocks -----------------------------------------------------------------

const mockDisputeFindUnique = vi.fn();
const mockDisputeUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: {
    agentDispute: {
      findUnique: (...args: unknown[]) => mockDisputeFindUnique(...args),
      update: (...args: unknown[]) => mockDisputeUpdate(...args),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// --- Fixtures ----------------------------------------------------------------

const SECRET = "test-gavel-secret";

const EVENT = JSON.stringify({
  type: "case.resolved",
  data: { caseId: "case_123", resolution: { awardedTo: "PARTY_A" } },
});

function sign(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function makeRequest(body: string, signature?: string): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature !== undefined) headers["x-gavel-signature"] = signature;
  return new NextRequest("http://localhost/api/webhooks/gavel", {
    method: "POST",
    headers,
    body,
  });
}

async function loadRoute() {
  vi.resetModules();
  return (await import("@/app/api/webhooks/gavel/route")).POST;
}

function expectNothingTouched() {
  expect(mockDisputeFindUnique).not.toHaveBeenCalled();
  expect(mockDisputeUpdate).not.toHaveBeenCalled();
}

// --- Tests -------------------------------------------------------------------

describe("POST /api/webhooks/gavel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDisputeFindUnique.mockResolvedValue({ id: "disp_1", resolutionData: null });
    mockDisputeUpdate.mockResolvedValue({ id: "disp_1" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("with GAVEL_WEBHOOK_SECRET set", () => {
    beforeEach(() => {
      vi.stubEnv("GAVEL_WEBHOOK_SECRET", SECRET);
    });

    it("accepts a correctly signed call and resolves the dispute", async () => {
      const POST = await loadRoute();
      const res = await POST(makeRequest(EVENT, sign(EVENT, SECRET)));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ received: true });
      expect(mockDisputeFindUnique).toHaveBeenCalledWith({
        where: { gavelCaseId: "case_123" },
      });
      expect(mockDisputeUpdate).toHaveBeenCalledTimes(1);
      const update = mockDisputeUpdate.mock.calls[0][0];
      expect(update.where).toEqual({ id: "disp_1" });
      expect(update.data.status).toBe("RESOLVED");
      expect(update.data.resolutionData).toEqual({ awardedTo: "PARTY_A" });
    });

    it("refuses an unsigned call and writes nothing", async () => {
      const POST = await loadRoute();
      const res = await POST(makeRequest(EVENT));

      expect(res.status).toBe(401);
      expectNothingTouched();
    });

    it("refuses a call signed with the wrong secret and writes nothing", async () => {
      const POST = await loadRoute();
      const res = await POST(makeRequest(EVENT, sign(EVENT, "some-other-secret")));

      expect(res.status).toBe(401);
      expectNothingTouched();
    });

    it("refuses a signature computed over a different body and writes nothing", async () => {
      const POST = await loadRoute();
      const tampered = EVENT.replace("PARTY_A", "PARTY_B");
      const res = await POST(makeRequest(tampered, sign(EVENT, SECRET)));

      expect(res.status).toBe(401);
      expectNothingTouched();
    });

    it("refuses a bare hex digest without the sha256= prefix", async () => {
      const POST = await loadRoute();
      const bare = sign(EVENT, SECRET).slice("sha256=".length);
      const res = await POST(makeRequest(EVENT, bare));

      expect(res.status).toBe(401);
      expectNothingTouched();
    });
  });

  describe("with GAVEL_WEBHOOK_SECRET unset", () => {
    it("fails closed with 503 even for a call signed with a plausible secret", async () => {
      vi.stubEnv("GAVEL_WEBHOOK_SECRET", "");
      const POST = await loadRoute();
      const res = await POST(makeRequest(EVENT, sign(EVENT, SECRET)));

      expect(res.status).toBe(503);
      expectNothingTouched();
    });
  });
});
