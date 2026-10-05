// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * POST /api/v1/agent/contracts: key, scopes, rate limit and body checks in
 * front of the one-call generation service.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const flags = vi.hoisted(() => ({ agentApi: true, stripeEnabled: true }));
vi.mock("@/config/features", () => ({ features: flags }));
vi.mock("@/lib/prisma", () => ({ prisma: {}, default: {} }));

const auth = vi.hoisted(() => {
  class ApiScopeError extends Error {}
  return {
    ApiScopeError,
    authenticateApiKey: vi.fn(),
    checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 99 })),
    requireScope: vi.fn((a: { scopes: string[] }, scope: string) => {
      if (!a.scopes.includes(scope)) throw new ApiScopeError(`API key missing required scope: ${scope}`);
    }),
  };
});
vi.mock("@/server/middleware/apiKeyAuth", () => auth);

vi.mock("@/server/middleware/idempotency", () => ({
  withIdempotency: (_req: unknown, _customer: string, fn: () => Promise<Response>) => fn(),
}));

const service = vi.hoisted(() => ({ generateContract: vi.fn() }));
vi.mock("@/server/services/agent/generateContract", async (orig) => ({
  ...(await orig<typeof import("@/server/services/agent/generateContract")>()),
  generateContract: service.generateContract,
}));

import { POST } from "@/app/api/v1/agent/contracts/route";

function req(body: unknown) {
  return new NextRequest("https://dealroom.test/api/v1/agent/contracts", {
    method: "POST",
    headers: { Authorization: "Bearer drk_test", "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const GOOD = { contractType: "NDA", governingLaw: "CALIFORNIA", party: { legalName: "Acme Inc" } };

beforeEach(() => {
  flags.agentApi = true;
  auth.authenticateApiKey.mockResolvedValue({
    customer: { id: "cust_1", name: "Acme", email: "a@acme.example" },
    apiKey: { id: "key_1", name: "k", scopes: ["negotiate", "deals:read"] },
    scopes: ["negotiate", "deals:read"],
  });
  service.generateContract.mockResolvedValue({ ok: true, status: 201, body: { dealId: "adr_1" } });
});

afterEach(() => vi.clearAllMocks());

describe("POST /api/v1/agent/contracts", () => {
  it("passes a valid body to the service and returns its answer", async () => {
    const res = await POST(req(GOOD));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ dealId: "adr_1" });
    expect(service.generateContract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ apiKey: expect.objectContaining({ id: "key_1" }) }),
      expect.objectContaining({ contractType: "NDA", party: { legalName: "Acme Inc" } }),
    );
  });

  it("passes the service's 402 through unchanged", async () => {
    service.generateContract.mockResolvedValue({ ok: false, status: 402, body: { code: "PAYMENT_REQUIRED" } });
    const res = await POST(req(GOOD));
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe("PAYMENT_REQUIRED");
  });

  it("needs a key", async () => {
    auth.authenticateApiKey.mockResolvedValue(null);
    expect((await POST(req(GOOD))).status).toBe(401);
  });

  it("needs both the negotiate and deals:read scopes", async () => {
    auth.authenticateApiKey.mockResolvedValue({
      customer: { id: "cust_1", name: "Acme", email: "a@acme.example" },
      apiKey: { id: "key_1", name: "k", scopes: ["negotiate"] },
      scopes: ["negotiate"],
    });
    const res = await POST(req(GOOD));
    expect(res.status).toBe(403);
    expect(service.generateContract).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON or misses required fields", async () => {
    expect((await POST(req("{not json"))).status).toBe(400);
    const missingParty = await POST(req({ contractType: "NDA" }));
    expect(missingParty.status).toBe(400);
    expect((await missingParty.json()).error).toBe("Invalid request body");
    expect((await POST(req({ ...GOOD, party: { legalName: "" } }))).status).toBe(400);
    expect(service.generateContract).not.toHaveBeenCalled();
  });

  it("applies the hourly limit of the deal-creating calls", async () => {
    auth.checkRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfter: 120 } as never);
    const res = await POST(req(GOOD));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("120");
    expect(auth.checkRateLimit).toHaveBeenCalledWith("cust_1", "negotiate");
  });

  it("is absent where the agent API is off", async () => {
    flags.agentApi = false;
    expect((await POST(req(GOOD))).status).toBe(404);
  });
});
