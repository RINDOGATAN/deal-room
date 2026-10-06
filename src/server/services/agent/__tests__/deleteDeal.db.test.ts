// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Deleting an agent deal against a real database, through the real REST
 * route and the real MCP server: the contract is made with
 * `generate_contract` (one credit spent), then deleted.
 *
 * Skipped unless DEALROOM_DB_TESTS=1, because it writes. Run it against a
 * throwaway Postgres with every migration applied and the built-in skills
 * seeded, never against a shared or production database:
 *
 *   DEALROOM_DB_TESTS=1 DATABASE_URL=postgresql://...local... \
 *     npx vitest run src/server/services/agent/__tests__/deleteDeal.db.test.ts
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const RUN = process.env.DEALROOM_DB_TESTS === "1";

// Billing on, so the contract spends a credit and leaves a payment record
// (a deal made before the billing start date would be free).
if (RUN) process.env.CONTRACT_BILLING_START = "2026-01-01T00:00:00Z";
vi.mock("@/config/features", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/features")>();
  return { features: { ...actual.features, stripeEnabled: true, agentApi: true } };
});

import prisma from "@/lib/prisma";
import { sha256 } from "@/lib/crypto";
import { DELETE as dealDELETE } from "@/app/api/v1/agent/deals/[id]/route";
import { POST as mcpPOST } from "@/app/api/v1/agent/mcp/route";

const run = randomBytes(4).toString("hex");
// Names that must not survive anywhere once the deal is deleted.
const OUR_NAME = `Ourside Testco ${run}`;
const THEIR_NAME = `Otherside Testco ${run}`;
const SIGNER = `Sam Signer ${run}`;

const A = { email: `owner-${run}@delete-test.invalid`, key: `drk_test_owner_${run}` };
const B = { email: `other-${run}@delete-test.invalid`, key: `drk_test_other_${run}` };
const ids: { customerA?: string; customerB?: string } = {};

async function makeCustomer(c: { email: string; key: string }, credits: number) {
  const customer = await prisma.customer.create({
    data: { name: `Account ${c.email}`, email: c.email, type: "SAAS" },
  });
  await prisma.apiKey.create({
    data: {
      customerId: customer.id,
      name: "test",
      keyHash: sha256(c.key),
      keyPrefix: c.key.slice(0, 12),
      scopes: ["negotiate", "deals:read", "templates:read", "billing:read"],
    },
  });
  await prisma.customerCredit.create({ data: { customerId: customer.id, balance: credits } });
  return customer.id;
}

function rest(id: string, key: string) {
  return dealDELETE(
    new NextRequest(`http://test/api/v1/agent/deals/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${key}` },
    }),
    { params: Promise.resolve({ id }) },
  );
}

let rpcId = 0;
async function mcp(key: string, name: string, args: Record<string, unknown>) {
  const res = await mcpPOST(
    new NextRequest("http://test/api/v1/agent/mcp", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name, arguments: args } }),
    }),
  );
  const body = (await res.json()) as {
    result: { isError: boolean; content: { text: string }[]; structuredContent?: Record<string, unknown> };
  };
  return body.result;
}

async function makeContract(key: string, idempotencyKey: string) {
  const result = await mcp(key, "generate_contract", {
    contractType: "NDA",
    governingLaw: "CALIFORNIA",
    party: { legalName: OUR_NAME, signatoryName: SIGNER, signatoryTitle: "CEO", email: A.email },
    counterparty: { legalName: THEIR_NAME, address: `1 Test Street ${run}` },
    idempotencyKey,
  });
  expect(result.isError, result.content[0]?.text).toBe(false);
  return result.structuredContent as { dealId: string; dealRoomId: string };
}

/** Every row of every table that mentions `needle`, as "table: count". */
async function rowsMentioning(needle: string) {
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'`;
  const hits: string[] = [];
  for (const { table_name } of tables) {
    const [{ n }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM "${table_name}" t WHERE t::text LIKE $1`,
      `%${needle}%`,
    );
    if (Number(n) > 0) hits.push(`${table_name}: ${n}`);
  }
  return hits;
}

describe.skipIf(!RUN)("DELETE /api/v1/agent/deals/:id against a database", () => {
  beforeAll(async () => {
    ids.customerA = await makeCustomer(A, 5);
    ids.customerB = await makeCustomer(B, 0);
  });

  afterAll(async () => {
    await prisma.customer.deleteMany({ where: { email: { in: [A.email, B.email] } } });
    await prisma.customerCredit.deleteMany({ where: { customerId: { in: [ids.customerA!, ids.customerB!] } } });
    await prisma.$disconnect();
  });

  it("owner deletes: 204, the content and names are gone, the payment record is kept without names", async () => {
    const deal = await makeContract(A.key, `idem-${run}-1`);

    // Before: the names sit in the deal, its party, the agent deal and the cached answer.
    const before = await rowsMentioning(THEIR_NAME);
    expect(before).toEqual(
      expect.arrayContaining([expect.stringMatching(/^deal_rooms:/), expect.stringMatching(/^idempotency_records:/)]),
    );
    expect(await rowsMentioning(OUR_NAME)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^deal_room_parties:/),
        expect.stringMatching(/^agent_deal_rooms:/),
      ]),
    );
    expect(await prisma.dealPayment.count({ where: { dealRoomId: deal.dealRoomId } })).toBe(1);
    expect(await prisma.dealRoomClause.count({ where: { dealRoomId: deal.dealRoomId } })).toBeGreaterThan(0);
    expect(await prisma.partySelection.count({ where: { party: { dealRoomId: deal.dealRoomId } } })).toBeGreaterThan(0);
    expect(await prisma.auditLog.count({ where: { dealRoomId: deal.dealRoomId } })).toBeGreaterThan(0);

    const res = await rest(deal.dealId, A.key);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");

    // Gone.
    expect(await prisma.agentDealRoom.findUnique({ where: { id: deal.dealId } })).toBeNull();
    expect(await prisma.dealRoom.findUnique({ where: { id: deal.dealRoomId } })).toBeNull();
    expect(await prisma.dealRoomParty.count({ where: { dealRoomId: deal.dealRoomId } })).toBe(0);
    expect(await prisma.dealRoomClause.count({ where: { dealRoomId: deal.dealRoomId } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { dealRoomId: deal.dealRoomId } })).toBe(0);
    expect(await prisma.idempotencyRecord.count({ where: { customerId: ids.customerA } })).toBe(0);
    expect(await prisma.dealPayment.count({ where: { dealRoomId: deal.dealRoomId } })).toBe(0);
    expect(await rowsMentioning(OUR_NAME)).toEqual([]);
    expect(await rowsMentioning(THEIR_NAME)).toEqual([]);
    expect(await rowsMentioning(SIGNER)).toEqual([]);

    // Kept: the billing record and the credit ledger, ids and amounts only.
    const kept = await prisma.deletedDealPayment.findMany({ where: { dealRoomId: deal.dealRoomId } });
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({
      dealRoomId: deal.dealRoomId,
      agentDealRoomId: deal.dealId,
      customerId: ids.customerA,
      kind: "CREDIT",
      status: "PAID",
    });
    const ledger = await prisma.customerCreditEntry.findMany({ where: { dealRoomId: deal.dealRoomId } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ customerId: ids.customerA, delta: -1, reason: "CONSUME" });
    expect((await prisma.customerCredit.findUnique({ where: { customerId: ids.customerA } }))?.balance).toBe(4);
    const record = await prisma.auditLog.findFirst({
      where: { action: "AGENT_DEAL_DELETED", details: { path: ["agentDealRoomId"], equals: deal.dealId } },
    });
    expect(record?.details).toEqual({
      customerId: ids.customerA,
      agentDealRoomId: deal.dealId,
      deletedDealRoomId: deal.dealRoomId,
      paymentsKept: 1,
    });

    // Repeat: 404.
    const again = await rest(deal.dealId, A.key);
    expect(again.status).toBe(404);
    expect(await again.json()).toMatchObject({ code: "NOT_FOUND" });
  });

  it("another account gets 404 and nothing is deleted", async () => {
    const deal = await makeContract(A.key, `idem-${run}-2`);
    const res = await rest(deal.dealId, B.key);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Deal not found", code: "NOT_FOUND" });
    expect(await prisma.dealRoom.findUnique({ where: { id: deal.dealRoomId } })).not.toBeNull();
    expect(await prisma.agentDealRoom.findUnique({ where: { id: deal.dealId } })).not.toBeNull();
    // Clean up through the owner.
    expect((await rest(deal.dealId, A.key)).status).toBe(204);
  });

  it("a two-party deal is refused with 409 and nothing is deleted", async () => {
    const template = await prisma.contractTemplate.findFirstOrThrow({ where: { contractType: "NDA" } });
    const room = await prisma.dealRoom.create({
      data: {
        name: `Two-party ${run}`,
        contractTemplateId: template.id,
        dealMode: "NEGOTIATION",
        governingLaw: "CALIFORNIA",
        status: "NEGOTIATING",
        parties: {
          create: [
            { role: "INITIATOR", email: A.email, company: OUR_NAME },
            { role: "RESPONDENT", email: B.email, company: THEIR_NAME },
          ],
        },
      },
    });
    const agentDeal = await prisma.agentDealRoom.create({
      data: {
        dealRoomId: room.id,
        negotiationToken: `nt_${run}_two`,
        initiatorCustomerId: ids.customerA!,
        respondentCustomerId: ids.customerB!,
        status: "AGREED",
        contractType: "NDA",
        governingLaw: "CALIFORNIA",
        dealName: `Two-party ${run}`,
        initiatorCompany: OUR_NAME,
        initiatorEmail: A.email,
        respondentCompany: THEIR_NAME,
        respondentEmail: B.email,
      },
    });

    const res = await rest(agentDeal.id, A.key);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "NOT_SINGLE_PARTY", error: expect.stringMatching(/single-party/) });
    expect(await prisma.dealRoomParty.count({ where: { dealRoomId: room.id } })).toBe(2);
    // The other party gets 404: it did not create the deal.
    expect((await rest(agentDeal.id, B.key)).status).toBe(404);

    await prisma.agentDealRoom.delete({ where: { id: agentDeal.id } });
    await prisma.dealRoom.delete({ where: { id: room.id } });
  });

  it("the MCP tool delete_deal follows the same rules", async () => {
    const deal = await makeContract(A.key, `idem-${run}-3`);

    const other = await mcp(B.key, "delete_deal", { dealId: deal.dealId });
    expect(other.isError).toBe(true);
    expect(other.content[0].text).toContain("HTTP 404");

    const done = await mcp(A.key, "delete_deal", { dealId: deal.dealId });
    expect(done.isError).toBe(false);
    expect(done.content[0].text).toMatch(/^Deleted\./);
    expect(await prisma.dealRoom.findUnique({ where: { id: deal.dealRoomId } })).toBeNull();
    expect(await prisma.deletedDealPayment.count({ where: { dealRoomId: deal.dealRoomId } })).toBe(1);

    const again = await mcp(A.key, "delete_deal", { dealId: deal.dealId });
    expect(again.isError).toBe(true);
    expect(again.content[0].text).toContain("HTTP 404");
    expect(again.content[0].text).toContain("NOT_FOUND");
  });
});
