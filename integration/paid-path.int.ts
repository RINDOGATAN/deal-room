// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * C7 (cycle 15): the paid path, end to end, against a real (throwaway)
 * Postgres and Stripe's official mock server.
 *
 *   draft -> agree -> 402 at download (and at the start of signature)
 *   -> checkout (Stripe, test mode) -> webhook signed with the test secret
 *   -> download -> signature
 *
 * Drives the real tRPC procedures (deal.create, selections.bulkSave,
 * deal.submitSelections, signing.*) and the real route handlers
 * (/api/deals/[id]/document, /api/deals/[id]/checkout, /api/webhooks/stripe).
 * Only the session lookup and the outgoing e-mail are replaced.
 *
 * Needs: DATABASE_URL on localhost (migrated + seeded with the built-in
 * skills), STRIPE_MOCK_URL (stripe/stripe-mock) or a Stripe TEST key. It
 * refuses to run against anything else. Run: `npm run test:integration`.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// ── Safety: never a production database, never a live key ───────────────
const dbUrl = process.env.DATABASE_URL ?? "";
const dbHost = (() => {
  try {
    return new URL(dbUrl).hostname;
  } catch {
    return "";
  }
})();
if (!["localhost", "127.0.0.1"].includes(dbHost)) {
  throw new Error("paid-path test: DATABASE_URL must point at a local throwaway database");
}
if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
  throw new Error("paid-path test: STRIPE_SECRET_KEY must be a test-mode key (sk_test_…)");
}

// ── The signed-in person, as the route handlers see them ─────────────────
const who = vi.hoisted(() => ({
  session: null as null | {
    user: { id: string; email: string; name: string; role: null };
    expires: string;
  },
  headers: new Headers(),
}));

vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: async () => who.session }));
vi.mock("next/headers", () => ({
  headers: async () => who.headers,
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@/lib/email", async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  const silent = async () => undefined;
  return {
    ...real,
    sendSigningInitiatedEmail: silent,
    sendCounterpartySignedEmail: silent,
    sendFirmasSigningEmail: silent,
    sendSigningNudgeEmail: silent,
    getResend: () => null,
  };
});

import { NextRequest } from "next/server";
import type Stripe from "stripe";
import prisma from "@/lib/prisma";
import { features } from "@/config/features";
import { getStripe } from "@/lib/stripe";
import { createInnerTRPCContext } from "@/server/trpc";
import { appRouter } from "@/server/routers";
import { GET as downloadPdf } from "@/app/api/deals/[id]/document/route";
import { POST as openCheckout } from "@/app/api/deals/[id]/checkout/route";
import { POST as stripeWebhook } from "@/app/api/webhooks/stripe/route";

const RUN = `ci-${Date.now()}`;
const EMAIL = `paid-path-${RUN}@example.test`;
let userId = "";
let dealRoomId = "";

function caller() {
  return appRouter.createCaller(
    createInnerTRPCContext({
      session: who.session,
      adminSession: null,
      supervisorSession: null,
      getCookie: () => undefined,
      clientIp: "127.0.0.1",
    }),
  );
}

const params = () => ({ params: Promise.resolve({ id: dealRoomId }) });

beforeAll(async () => {
  expect(features.stripeEnabled).toBe(true);
  const user = await prisma.user.create({
    data: { email: EMAIL, name: "Paid Path Tester", emailVerified: new Date() },
  });
  userId = user.id;
  who.session = {
    user: { id: user.id, email: EMAIL, name: "Paid Path Tester", role: null },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  };
});

afterAll(async () => {
  // The database is throwaway; still, leave nothing of this run behind.
  if (dealRoomId) {
    await prisma.dealPayment.deleteMany({ where: { dealRoomId } });
    await prisma.dealRoom.delete({ where: { id: dealRoomId } }).catch(() => undefined);
  }
  await prisma.customer.deleteMany({ where: { email: EMAIL } }).catch(() => undefined);
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  await prisma.$disconnect();
});

describe("paid path: draft, agree, 402, checkout, webhook, download, signature", () => {
  it("1. drafts a solo NDA", async () => {
    const deal = await caller().deal.create({
      name: `Paid path ${RUN}`,
      contractType: "NDA",
      governingLaw: "ENGLAND_WALES",
      contractLanguage: "en",
      dealMode: "SOLO",
    });
    dealRoomId = deal.id;
    expect(deal.clauses.length).toBeGreaterThan(0);
  });

  it("2. agrees every clause", async () => {
    const clauses = await prisma.dealRoomClause.findMany({
      where: { dealRoomId },
      include: {
        clauseTemplate: {
          include: { options: { where: { retiredAt: null }, orderBy: { order: "asc" } } },
        },
      },
    });
    await caller().selections.bulkSave({
      dealRoomId,
      selections: clauses.map((c) => ({
        dealRoomClauseId: c.id,
        optionId: c.clauseTemplate.options[0]!.id,
        priority: 3,
        flexibility: 3,
      })),
    });
    const res = await caller().deal.submitSelections({ dealRoomId });
    expect(res.soloCompleted).toBe(true);
    const deal = await prisma.dealRoom.findUniqueOrThrow({ where: { id: dealRoomId } });
    expect(deal.status).toBe("AGREED");
  });

  it("3. refuses the download with 402 and the start of signature with PAYMENT_REQUIRED", async () => {
    const res = await downloadPdf(
      new NextRequest(`http://127.0.0.1/api/deals/${dealRoomId}/document`),
      params(),
    );
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.code).toBe("PAYMENT_REQUIRED");
    expect(body.checkout.url).toBe(`/api/deals/${dealRoomId}/checkout`);

    await caller().signing.submitSigningDetails({
      dealRoomId,
      details: {
        legalName: "Paid Path Ltd",
        address: "1 Test Street, London",
        signatoryName: "Paid Path Tester",
        signatoryTitle: "Director",
      },
    });
    await expect(caller().signing.initiate({ dealRoomId })).rejects.toMatchObject({
      code: "PAYMENT_REQUIRED",
    });
  });

  let checkoutSession: Stripe.Checkout.Session | null = null;
  let checkoutParams: Stripe.Checkout.SessionCreateParams | null = null;

  it("4. opens a Stripe checkout (test mode) for this deal", async () => {
    const sessions = getStripe().checkout.sessions;
    const create = sessions.create.bind(sessions);
    // Watch the real call: what the route asked Stripe for, and the session
    // Stripe returned (its id is what the webhook will carry).
    const record = async (p?: Stripe.Checkout.SessionCreateParams, o?: Stripe.RequestOptions) => {
      checkoutParams = p ?? null;
      const s = await create(p, o);
      checkoutSession = s;
      return s;
    };
    const spy = vi.spyOn(sessions, "create").mockImplementation(record as never);

    const res = await openCheckout(
      new NextRequest(`http://127.0.0.1/api/deals/${dealRoomId}/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currency: "eur" }),
      }),
      params(),
    );
    spy.mockRestore();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.currency).toBe("eur");
    expect(typeof body.url).toBe("string");
    expect(checkoutSession?.id).toMatch(/^cs_/);
    expect(checkoutParams).toMatchObject({
      mode: "payment",
      currency: "eur",
      line_items: [{ price: process.env.STRIPE_PRICE_CONTRACT_EUR, quantity: 1 }],
      metadata: { kind: "contract", dealRoomId, userId },
    });
  });

  function completedEvent(eventId: string): string {
    const meta = checkoutParams!.metadata as Record<string, string>;
    return JSON.stringify({
      id: eventId,
      object: "event",
      api_version: "2026-01-28.clover",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      type: "checkout.session.completed",
      data: {
        object: {
          id: checkoutSession!.id,
          object: "checkout.session",
          mode: "payment",
          payment_status: "paid",
          status: "complete",
          payment_intent: `pi_${RUN}`,
          amount_total: 2900,
          currency: "eur",
          customer: checkoutParams!.customer,
          metadata: meta,
        },
      },
    });
  }

  async function deliver(payload: string, signature: string) {
    who.headers = new Headers({ "stripe-signature": signature, "content-type": "application/json" });
    const res = await stripeWebhook(
      new NextRequest("http://127.0.0.1/api/webhooks/stripe", { method: "POST", body: payload }),
    );
    who.headers = new Headers();
    return res;
  }

  it("5. rejects a webhook with a bad signature, accepts the one signed with the test secret", async () => {
    const payload = completedEvent(`evt_${RUN}`);

    const forged = await deliver(payload, "t=1,v1=deadbeef");
    expect(forged.status).toBe(400);
    expect(await prisma.dealPayment.count({ where: { dealRoomId } })).toBe(0);

    const signature = getStripe().webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
    });
    const ok = await deliver(payload, signature);
    expect(ok.status).toBe(200);

    const payment = await prisma.dealPayment.findFirstOrThrow({ where: { dealRoomId } });
    expect(payment).toMatchObject({
      kind: "CONTRACT",
      status: "PAID",
      stripeCheckoutSessionId: checkoutSession!.id,
      payerUserId: userId,
      currency: "eur",
    });

    // A redelivery is recognised and changes nothing.
    const again = await deliver(payload, signature);
    expect(await again.json()).toMatchObject({ idempotent: true });
    expect(await prisma.dealPayment.count({ where: { dealRoomId } })).toBe(1);
  });

  it("6. serves the download once paid", async () => {
    const res = await downloadPdf(
      new NextRequest(`http://127.0.0.1/api/deals/${dealRoomId}/document`),
      params(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("7. starts the signature and records it", async () => {
    const request = await caller().signing.initiate({ dealRoomId });
    expect(request.status).toBe("PENDING");
    expect((await prisma.dealRoom.findUniqueOrThrow({ where: { id: dealRoomId } })).status).toBe("SIGNING");

    const signed = await caller().signing.recordSignature({
      signingRequestId: request.id,
      partyRole: "INITIATOR",
      signature: "Paid Path Tester",
    });
    expect(signed.initiatorSignedAt).toBeTruthy();
    expect(signed.initiatorSignature).toBe("Paid Path Tester");
  });
});
