// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * GET /api/v1/agent/credits/invoices: the customer's pack purchases, each
 * with its invoice read on demand; older purchases have none.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const flags = vi.hoisted(() => ({ agentApi: true, stripeEnabled: true }));
vi.mock("@/config/features", () => ({ features: flags }));

const db = vi.hoisted(() => ({ customerCreditEntry: { findMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));

const stripe = vi.hoisted(() => ({ getInvoiceLinksForSessions: vi.fn() }));
vi.mock("@/lib/stripe", () => stripe);

const auth = vi.hoisted(() => ({
  authenticateApiKey: vi.fn(),
  requireScope: vi.fn(),
  ApiScopeError: class extends Error {},
}));
vi.mock("@/server/middleware/apiKeyAuth", () => auth);

import { GET } from "@/app/api/v1/agent/credits/invoices/route";

const req = () => new NextRequest("https://dealroom.test/api/v1/agent/credits/invoices");

beforeEach(() => {
  flags.stripeEnabled = true;
  auth.authenticateApiKey.mockResolvedValue({
    customer: { id: "cust_1", email: "agent@example.com", name: "Agent Co" },
    apiKey: { id: "key_1", name: "k", scopes: ["billing:read"] },
  });
  db.customerCreditEntry.findMany.mockResolvedValue([
    { delta: 10, apiKeyId: "key_2", createdAt: new Date("2026-10-01T09:00:00Z"), stripeCheckoutSessionId: "cs_new" },
    { delta: 10, apiKeyId: "key_1", createdAt: new Date("2026-09-30T09:00:00Z"), stripeCheckoutSessionId: "cs_old" },
  ]);
  stripe.getInvoiceLinksForSessions.mockResolvedValue([
    { invoiceId: "in_1", number: "ABC-0001", hostedInvoiceUrl: "https://invoice.test/i", invoicePdf: "https://invoice.test/p" },
    null,
  ]);
});

afterEach(() => vi.clearAllMocks());

describe("agent pack invoices", () => {
  it("lists the customer's purchases with their invoice, null for older ones", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(db.customerCreditEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ customerId: "cust_1", reason: "PURCHASE" }) }),
    );
    expect(stripe.getInvoiceLinksForSessions).toHaveBeenCalledWith(["cs_new", "cs_old"]);
    expect(body.purchases[0].invoice).toEqual({
      number: "ABC-0001",
      hostedInvoiceUrl: "https://invoice.test/i",
      invoicePdf: "https://invoice.test/p",
    });
    expect(body.purchases[1].invoice).toBeNull();
  });

  it("answers an empty list when payments are off", async () => {
    flags.stripeEnabled = false;
    expect(await (await GET(req())).json()).toEqual({ billing: "off", purchases: [] });
    expect(stripe.getInvoiceLinksForSessions).not.toHaveBeenCalled();
  });

  it("needs a key", async () => {
    auth.authenticateApiKey.mockResolvedValue(null);
    expect((await GET(req())).status).toBe(401);
  });
});
