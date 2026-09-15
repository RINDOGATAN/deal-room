// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Route tests for the Gavel hand-off (POST /api/v1/agent/deals/:id/dispute).
 *
 * Two contracts are pinned here:
 *   1. With GAVEL_API_URL and GAVEL_API_KEY set, the route opens a case at
 *      `<url>/cases` with a bearer token and the documented payload, then
 *      stores the returned case id.
 *   2. With either variable missing (or empty, as the sovereign compose file
 *      injects), the route answers 503 `{ error: "gavel_not_configured" }`
 *      before reading or writing anything. No placeholder case is ever stored.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks -----------------------------------------------------------------

const mockAuthenticateApiKey = vi.fn();
vi.mock("@/server/middleware/apiKeyAuth", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/middleware/apiKeyAuth")
  >("@/server/middleware/apiKeyAuth");
  return {
    ...actual,
    authenticateApiKey: (...args: unknown[]) => mockAuthenticateApiKey(...args),
  };
});

const mockAgentDealFindUnique = vi.fn();
const mockDisputeCreate = vi.fn();
const mockIdempotencyFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: {
    agentDealRoom: {
      findUnique: (...args: unknown[]) => mockAgentDealFindUnique(...args),
    },
    agentDispute: {
      create: (...args: unknown[]) => mockDisputeCreate(...args),
    },
    idempotencyRecord: {
      findUnique: (...args: unknown[]) => mockIdempotencyFindUnique(...args),
      create: vi.fn(),
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

import { POST } from "@/app/api/v1/agent/deals/[id]/dispute/route";

// --- Fixtures ----------------------------------------------------------------

const CUSTOMER_ID = "cust_initiator";

const AUTH = {
  customer: { id: CUSTOMER_ID },
  apiKey: { id: "key1", name: "test", scopes: ["disputes:create"] },
  scopes: ["disputes:create"],
};

const DEAL = {
  id: "adr_1",
  dealRoomId: "deal_1",
  status: "FAILED",
  initiatorCustomerId: CUSTOMER_ID,
  respondentCustomerId: "cust_respondent",
  initiatorCompany: "Claimant Co",
  initiatorEmail: "claimant@example.test",
  respondentCompany: "Respondent Co",
  respondentEmail: "respondent@example.test",
  contractType: "A2A_SERVICE",
  governingLaw: "SPAIN",
  dispute: null,
};

function post(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/v1/agent/deals/adr_1/dispute", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer drk_test",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const params = Promise.resolve({ id: "adr_1" });

const ORIGINAL_ENV = { ...process.env };

function setGavelEnv(url: string | undefined, key: string | undefined) {
  if (url === undefined) delete process.env.GAVEL_API_URL;
  else process.env.GAVEL_API_URL = url;
  if (key === undefined) delete process.env.GAVEL_API_KEY;
  else process.env.GAVEL_API_KEY = key;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthenticateApiKey.mockResolvedValue(AUTH);
  mockAgentDealFindUnique.mockResolvedValue(DEAL);
  mockDisputeCreate.mockImplementation(async ({ data }) => ({
    id: "dispute_1",
    createdAt: new Date("2026-09-15T10:00:00.000Z"),
    ...data,
  }));
  mockIdempotencyFindUnique.mockResolvedValue(null);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

// --- Configured: outbound case payload ----------------------------------------

describe("dispute route with Gavel configured", () => {
  beforeEach(() => {
    setGavelEnv("https://gavel.example.test/api/v1/", "gavel_secret_key");
  });

  it("opens a case at <GAVEL_API_URL>/cases with the bearer key and the documented payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "gavel_case_123",
          url: "https://gavel.example.test/cases/gavel_case_123",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      post({ reason: "Breach of the retention clause", escrowAmount: 50000 }),
      { params }
    );

    expect(res.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // Trailing slash on the configured URL must not produce a double slash.
    expect(url).toBe("https://gavel.example.test/api/v1/cases");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer gavel_secret_key",
    });

    const payload = JSON.parse(String(init.body));
    expect(payload).toEqual({
      type: "contract_dispute",
      parties: [
        {
          role: "claimant",
          company: "Claimant Co",
          email: "claimant@example.test",
        },
        {
          role: "respondent",
          company: "Respondent Co",
          email: "respondent@example.test",
        },
      ],
      contractType: "A2A_SERVICE",
      governingLaw: "SPAIN",
      reason: "Breach of the retention clause",
      escrowAmount: 50000,
      metadata: { agentDealRoomId: "adr_1", dealRoomId: "deal_1" },
    });

    // The returned case id is what gets stored, never a placeholder.
    expect(mockDisputeCreate).toHaveBeenCalledTimes(1);
    expect(mockDisputeCreate.mock.calls[0][0].data).toMatchObject({
      agentDealRoomId: "adr_1",
      gavelCaseId: "gavel_case_123",
      escrowAmount: 50000,
      status: "PENDING",
    });

    const body = await res.json();
    expect(body).toMatchObject({
      disputeId: "dispute_1",
      gavelCaseId: "gavel_case_123",
      gavelCaseUrl: "https://gavel.example.test/cases/gavel_case_123",
      status: "PENDING",
    });
  });

  it("swaps claimant and respondent when the respondent escalates", async () => {
    mockAuthenticateApiKey.mockResolvedValue({
      ...AUTH,
      customer: { id: "cust_respondent" },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "gavel_case_456" }), { status: 201 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(post({}), { params });
    expect(res.status).toBe(201);

    const payload = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(payload.parties[0]).toMatchObject({ role: "claimant", company: "Respondent Co" });
    expect(payload.parties[1]).toMatchObject({ role: "respondent", company: "Claimant Co" });
    expect(payload.reason).toBe("Dispute escalated from Dealroom");
    expect(payload.escrowAmount).toBeUndefined();
  });

  it("answers 502 and stores nothing when Gavel rejects the case", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("bad request", { status: 400 }))
    );

    const res = await POST(post({}), { params });
    expect(res.status).toBe(502);
    expect(mockDisputeCreate).not.toHaveBeenCalled();
  });

  it("answers 503 and stores nothing when Gavel cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const res = await POST(post({}), { params });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Gavel service unavailable" });
    expect(mockDisputeCreate).not.toHaveBeenCalled();
  });
});

// --- Not configured: honest refusal ------------------------------------------

describe("dispute route without Gavel configured", () => {
  const cases: [string, string | undefined, string | undefined][] = [
    ["both variables unset", undefined, undefined],
    ["key unset", "https://gavel.example.test/api/v1", undefined],
    ["URL unset", undefined, "gavel_secret_key"],
    ["both empty strings (compose default)", "", ""],
    ["key blank", "https://gavel.example.test/api/v1", "   "],
  ];

  it.each(cases)(
    "answers 503 gavel_not_configured and stores nothing when %s",
    async (_label, url, key) => {
      setGavelEnv(url, key);
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const res = await POST(post({ reason: "x" }), { params });

      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: "gavel_not_configured" });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(mockDisputeCreate).not.toHaveBeenCalled();
      // Refusal happens before the deal is even looked up.
      expect(mockAgentDealFindUnique).not.toHaveBeenCalled();
    }
  );

  it("still requires authentication before revealing the configuration state", async () => {
    setGavelEnv(undefined, undefined);
    mockAuthenticateApiKey.mockResolvedValue(null);

    const res = await POST(post({}), { params });
    expect(res.status).toBe(401);
  });

  it("still requires the disputes:create scope", async () => {
    setGavelEnv(undefined, undefined);
    mockAuthenticateApiKey.mockResolvedValue({
      ...AUTH,
      apiKey: { ...AUTH.apiKey, scopes: ["deals:read"] },
      scopes: ["deals:read"],
    });

    const res = await POST(post({}), { params });
    expect(res.status).toBe(403);
  });
});
