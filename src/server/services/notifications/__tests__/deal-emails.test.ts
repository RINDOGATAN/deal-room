// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Transactional deal emails: claiming, sending and the cron selection.
 * Hermetic: Prisma, the feature flags, prices and the sender are mocked.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const flags = vi.hoisted(() => ({ stripeEnabled: true }));
vi.mock("@/config/features", () => ({ features: flags }));

const db = vi.hoisted(() => ({
  dealRoom: { findUnique: vi.fn(), findMany: vi.fn() },
  dealNotification: { create: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
  invitation: { findMany: vi.fn() },
  customer: { findFirst: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));

const send = vi.hoisted(() => ({ sendDealEmail: vi.fn() }));
vi.mock("@/lib/email", () => send);

vi.mock("../../billing/pricing", () => ({
  getPriceTable: vi.fn(async () => ({
    contract: { usd: { priceId: "p_usd", amount: 2900, currency: "usd" }, eur: { priceId: "p_eur", amount: 2700, currency: "eur" } },
    credits10: { usd: null, eur: null },
  })),
}));
const paid = vi.hoisted(() => ({ isDealPaid: vi.fn() }));
vi.mock("../../billing/deal-entitlement", () => paid);

import {
  notifyDealReady,
  notifyTurn,
  runDraftReminderJob,
  runInvitationReminderJob,
  runReadySweepJob,
} from "../deal-emails";

const DAY = 86_400_000;
const NOW = new Date("2026-10-20T09:00:00Z");
const ago = (d: number) => new Date(NOW.getTime() - d * DAY);
const ORIGINAL = { start: process.env.CONTRACT_BILLING_START, url: process.env.NEXTAUTH_URL, display: process.env.PRICE_DISPLAY_CONTRACT };

const parties = [
  { id: "pa", role: "INITIATOR", userId: "ua", email: "a@example.com", name: "Ana", user: { email: "ana@example.com", name: "Ana Ruiz" } },
  { id: "pb", role: "RESPONDENT", userId: "ub", email: "bruno@example.com", name: null, user: { email: "bruno@example.com", name: "Bruno" } },
];

function deal(extra: Record<string, unknown> = {}) {
  return {
    id: "d1",
    name: "Acme NDA",
    status: "NEGOTIATING",
    dealMode: "NEGOTIATION",
    createdAt: ago(5),
    governingLaw: "CALIFORNIA",
    contractLanguage: "en",
    agentDealRoom: null,
    parties,
    ...extra,
  };
}

const unique = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });

beforeEach(() => {
  vi.clearAllMocks();
  flags.stripeEnabled = true;
  process.env.CONTRACT_BILLING_START = "2026-09-30";
  process.env.NEXTAUTH_URL = "https://dealroom.example";
  delete process.env.PRICE_DISPLAY_CONTRACT;
  db.dealNotification.create.mockResolvedValue({});
  db.dealNotification.deleteMany.mockResolvedValue({ count: 1 });
  db.dealNotification.findMany.mockResolvedValue([]);
  db.customer.findFirst.mockResolvedValue(null);
  send.sendDealEmail.mockResolvedValue(true);
  paid.isDealPaid.mockResolvedValue({ paid: false });
});

afterAll(() => {
  for (const [key, value] of [
    ["CONTRACT_BILLING_START", ORIGINAL.start],
    ["NEXTAUTH_URL", ORIGINAL.url],
    ["PRICE_DISPLAY_CONTRACT", ORIGINAL.display],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("notifyTurn", () => {
  it("claims, then emails the other party a link to the deal", async () => {
    db.dealRoom.findUnique.mockResolvedValue(deal());
    await expect(notifyTurn({ dealRoomId: "d1", fromPartyId: "pa", kind: "TURN_SELECTIONS" })).resolves.toBe("sent");
    expect(db.dealNotification.create).toHaveBeenCalledWith({
      data: {
        dealRoomId: "d1",
        kind: "TURN_SELECTIONS",
        recipientEmail: "bruno@example.com",
        dedupeKey: "turn-selections:d1:pa:pb",
      },
    });
    expect(send.sendDealEmail).toHaveBeenCalledWith(
      "bruno@example.com",
      expect.objectContaining({ kind: "TURN_SELECTIONS", url: "https://dealroom.example/deals/d1", otherName: "Ana Ruiz" }),
    );
  });

  it("never sends the same email twice (the key is already claimed)", async () => {
    db.dealRoom.findUnique.mockResolvedValue(deal());
    db.dealNotification.create.mockRejectedValue(unique());
    await expect(
      notifyTurn({ dealRoomId: "d1", fromPartyId: "pb", kind: "TURN_COUNTER", roundId: "r1" }),
    ).resolves.toBe("skipped");
    expect(send.sendDealEmail).not.toHaveBeenCalled();
  });

  it("releases the claim when the send fails, so a later attempt can retry", async () => {
    db.dealRoom.findUnique.mockResolvedValue(deal());
    send.sendDealEmail.mockResolvedValue(false);
    await expect(
      notifyTurn({ dealRoomId: "d1", fromPartyId: "pb", kind: "TURN_COUNTER", roundId: "r1" }),
    ).resolves.toBe("failed");
    expect(db.dealNotification.deleteMany).toHaveBeenCalledWith({ where: { dedupeKey: "turn-counter:r1:pb:pa" } });
  });

  it("never emails about a deal that predates billing", async () => {
    db.dealRoom.findUnique.mockResolvedValue(deal({ createdAt: new Date("2026-09-29T23:59:59Z") }));
    await expect(notifyTurn({ dealRoomId: "d1", fromPartyId: "pa", kind: "TURN_SELECTIONS" })).resolves.toBe("skipped");
    expect(db.dealNotification.create).not.toHaveBeenCalled();
    expect(send.sendDealEmail).not.toHaveBeenCalled();
  });

  it("sends nothing for agent deals or solo deals", async () => {
    db.dealRoom.findUnique.mockResolvedValue(deal({ agentDealRoom: { id: "ag" } }));
    await notifyTurn({ dealRoomId: "d1", fromPartyId: "pa", kind: "TURN_SELECTIONS" });
    db.dealRoom.findUnique.mockResolvedValue(deal({ dealMode: "SOLO", parties: [parties[0]] }));
    await notifyTurn({ dealRoomId: "d1", fromPartyId: "pa", kind: "TURN_SELECTIONS" });
    expect(send.sendDealEmail).not.toHaveBeenCalled();
  });

  it("never throws into the negotiation step", async () => {
    db.dealRoom.findUnique.mockRejectedValue(new Error("db down"));
    await expect(notifyTurn({ dealRoomId: "d1", fromPartyId: "pa", kind: "TURN_SELECTIONS" })).resolves.toBe("failed");
  });
});

describe("notifyDealReady", () => {
  it("emails both parties the price in their own currency and the Get this contract link", async () => {
    db.dealRoom.findUnique.mockResolvedValue(deal({ status: "AGREED" }));
    // Bruno stored euros at an earlier checkout; Ana has no preference (California deal: dollars).
    db.customer.findFirst.mockImplementation(async ({ where }: { where: { email: { equals: string } } }) =>
      where.email.equals === "bruno@example.com" ? { metadata: { preferredCurrency: "eur" } } : null,
    );
    await expect(notifyDealReady("d1")).resolves.toEqual({ sent: 2, failed: 0 });
    const calls = send.sendDealEmail.mock.calls;
    expect(calls.map((c) => c[0])).toEqual(["ana@example.com", "bruno@example.com"]);
    expect(calls[0][1]).toMatchObject({ kind: "READY", price: "$29", url: "https://dealroom.example/deals/d1/sign" });
    expect(calls[1][1]).toMatchObject({ kind: "READY", price: "€27" });
    expect(db.dealNotification.create.mock.calls.map((c) => c[0].data.dedupeKey)).toEqual(["ready:d1:pa", "ready:d1:pb"]);
  });

  it("sends nothing when the deal is paid, not agreed, predates billing, or payments are off", async () => {
    paid.isDealPaid.mockResolvedValue({ paid: true, via: "payment" });
    db.dealRoom.findUnique.mockResolvedValue(deal({ status: "AGREED" }));
    await notifyDealReady("d1");

    paid.isDealPaid.mockResolvedValue({ paid: false });
    db.dealRoom.findUnique.mockResolvedValue(deal({ status: "NEGOTIATING" }));
    await notifyDealReady("d1");

    db.dealRoom.findUnique.mockResolvedValue(deal({ status: "AGREED", createdAt: new Date("2026-09-01T00:00:00Z") }));
    await notifyDealReady("d1");

    flags.stripeEnabled = false;
    db.dealRoom.findUnique.mockResolvedValue(deal({ status: "AGREED" }));
    await notifyDealReady("d1");

    expect(send.sendDealEmail).not.toHaveBeenCalled();
  });

  it("the sweep skips deals whose parties were all told", async () => {
    db.dealRoom.findMany.mockResolvedValue([
      { id: "d1", _count: { parties: 2 }, notifications: [{ id: "n1" }, { id: "n2" }] },
    ]);
    await expect(runReadySweepJob()).resolves.toEqual({ ran: 0, errors: 0 });
    expect(db.dealRoom.findUnique).not.toHaveBeenCalled();
  });
});

describe("runInvitationReminderJob", () => {
  const invitation = (id: string, sentDaysAgo: number, respondentJoined = false) => ({
    id,
    email: `${id}@example.com`,
    token: `tok-${id}`,
    status: "PENDING",
    sentAt: ago(sentDaysAgo),
    expiresAt: new Date(ago(sentDaysAgo).getTime() + 14 * DAY),
    sentBy: { name: "Ana Ruiz" },
    dealRoom: {
      id: `deal-${id}`,
      name: "Acme NDA",
      createdAt: ago(20),
      contractLanguage: "es",
      parties: respondentJoined ? [{ userId: "ub" }] : [],
    },
  });

  it("does nothing without a billing start", async () => {
    delete process.env.CONTRACT_BILLING_START;
    await expect(runInvitationReminderJob(NOW)).resolves.toEqual({ ran: 0, errors: 0 });
    expect(db.invitation.findMany).not.toHaveBeenCalled();
  });

  it("only asks for invitations on deals created on or after the billing start", async () => {
    db.invitation.findMany.mockResolvedValue([]);
    await runInvitationReminderJob(NOW);
    const where = db.invitation.findMany.mock.calls[0][0].where;
    expect(where.dealRoom.createdAt).toEqual({ gte: new Date("2026-09-30") });
    expect(where.status).toBe("PENDING");
  });

  it("sends day 3 and day 10 once each, and nothing once the counterparty joined", async () => {
    db.invitation.findMany.mockResolvedValue([
      invitation("i3", 4),
      invitation("i10", 11),
      invitation("i10done", 12),
      invitation("joined", 5, true),
    ]);
    db.dealNotification.findMany.mockResolvedValue([{ dedupeKey: "invite-day10:i10done" }, { dedupeKey: "invite-day3:i10done" }]);

    await expect(runInvitationReminderJob(NOW)).resolves.toEqual({ ran: 2, errors: 0 });
    const sent = send.sendDealEmail.mock.calls.map((c) => [c[0], c[1].kind]);
    expect(sent).toEqual([
      ["i3@example.com", "INVITE_DAY3"],
      ["i10@example.com", "INVITE_DAY10"],
    ]);
    expect(send.sendDealEmail.mock.calls[0][1]).toMatchObject({
      language: "es",
      url: "https://dealroom.example/invite/tok-i3",
      otherName: "Ana Ruiz",
    });
  });
});

describe("runDraftReminderJob", () => {
  const draft = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    name: "Draft MSA",
    status: "DRAFT",
    createdAt: ago(6),
    updatedAt: ago(3),
    contractLanguage: "en",
    parties: [{ ...parties[0], updatedAt: ago(3), selections: [{ updatedAt: ago(3) }] }],
    auditLogs: [{ createdAt: ago(3) }],
    ...extra,
  });

  it("does nothing without a billing start", async () => {
    delete process.env.CONTRACT_BILLING_START;
    await expect(runDraftReminderJob(NOW)).resolves.toEqual({ ran: 0, errors: 0 });
    expect(db.dealRoom.findMany).not.toHaveBeenCalled();
  });

  it("asks only for drafts after the billing start that were never reminded", async () => {
    db.dealRoom.findMany.mockResolvedValue([]);
    await runDraftReminderJob(NOW);
    const where = db.dealRoom.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("DRAFT");
    expect(where.createdAt).toEqual({ gte: new Date("2026-09-30") });
    expect(where.notifications).toEqual({ none: { kind: "DRAFT" } });
  });

  it("reminds the initiator two days after the last activity, with a plain link to the draft", async () => {
    db.dealRoom.findMany.mockResolvedValue([
      draft("idle"),
      // A clause choice yesterday: still active.
      draft("busy", { parties: [{ ...parties[0], updatedAt: ago(3), selections: [{ updatedAt: ago(1) }] }] }),
    ]);
    await expect(runDraftReminderJob(NOW)).resolves.toEqual({ ran: 1, errors: 0 });
    expect(send.sendDealEmail).toHaveBeenCalledTimes(1);
    expect(send.sendDealEmail).toHaveBeenCalledWith(
      "ana@example.com",
      expect.objectContaining({ kind: "DRAFT", url: "https://dealroom.example/deals/idle" }),
    );
    expect(db.dealNotification.create.mock.calls[0][0].data.dedupeKey).toBe("draft:idle");
  });
});
