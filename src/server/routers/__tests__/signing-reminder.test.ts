// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * signing.sendReminder — the manual stall nudge.
 *
 * The reminder must be party-scoped, refuse solo deals and already-signed
 * counterparties, and enforce the 72h cooldown server-side (the UI mirrors
 * it, but the server rule is what stops the button being a harassment
 * lever). The happy path emails the counterparty, stamps
 * manualReminderSentAt and writes an audit row.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";

const mocks = vi.hoisted(() => ({
  prisma: {
    signingRequest: { findFirst: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  sendSigningNudgeEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ decode: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => ({ get: () => null }),
}));
vi.mock("@/lib/email", () => ({
  sendSigningInitiatedEmail: vi.fn(),
  sendCounterpartySignedEmail: vi.fn(),
  sendFirmasSigningEmail: vi.fn(),
  sendSigningNudgeEmail: mocks.sendSigningNudgeEmail,
}));
vi.mock("@/lib/certification-client", () => ({ certificationService: {} }));
vi.mock("@/server/services/document/generator", () => ({
  generateContractData: vi.fn(),
}));
vi.mock("@/server/services/ai/posture", () => ({
  requireAi: vi.fn(),
  assertAiRateLimit: vi.fn(),
  recordGeneration: vi.fn(),
}));
vi.mock("@/server/services/ai/llm-door", () => ({ chatComplete: vi.fn() }));

import { createInnerTRPCContext } from "@/server/trpc";
import { signingRouter } from "@/server/routers/signing";

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.test`, name: userId, role: null },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  };
}

function callerFor(session: Session | null) {
  const ctx = createInnerTRPCContext({
    session,
    adminSession: null,
    supervisorSession: null,
    getCookie: () => undefined,
  });
  return signingRouter.createCaller(ctx);
}

const alice = sessionFor("user-alice");

/** Active two-party signing where Alice (initiator) signed and Bob hasn't. */
function stalledRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "sr-1",
    dealRoomId: "deal-1",
    status: "PARTIALLY_SIGNED",
    initiatorSignedAt: new Date("2026-07-20T10:00:00Z"),
    respondentSignedAt: null,
    manualReminderSentAt: null,
    createdAt: new Date("2026-07-19T10:00:00Z"),
    dealRoom: {
      id: "deal-1",
      name: "Stalled NDA",
      dealMode: "NEGOTIATION",
      parties: [
        {
          id: "p-alice",
          userId: "user-alice",
          role: "INITIATOR",
          email: null,
          name: "Alice",
          user: { email: "user-alice@example.test", name: "Alice" },
        },
        {
          id: "p-bob",
          userId: "user-bob",
          role: "RESPONDENT",
          email: "bob@example.test",
          name: "Bob",
          user: null,
        },
      ],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.signingRequest.update.mockResolvedValue({});
  mocks.prisma.auditLog.create.mockResolvedValue({});
});

describe("signing.sendReminder", () => {
  it("rejects a caller who is not a party", async () => {
    mocks.prisma.signingRequest.findFirst.mockResolvedValue(stalledRequest());
    await expect(
      callerFor(sessionFor("user-mallory")).sendReminder({ dealRoomId: "deal-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.sendSigningNudgeEmail).not.toHaveBeenCalled();
  });

  it("rejects solo deals — there is no counterparty to remind", async () => {
    const req = stalledRequest();
    req.dealRoom.dealMode = "SOLO";
    mocks.prisma.signingRequest.findFirst.mockResolvedValue(req);
    await expect(
      callerFor(alice).sendReminder({ dealRoomId: "deal-1" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects when the other party has already signed", async () => {
    mocks.prisma.signingRequest.findFirst.mockResolvedValue(
      stalledRequest({ respondentSignedAt: new Date() }),
    );
    await expect(
      callerFor(alice).sendReminder({ dealRoomId: "deal-1" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.sendSigningNudgeEmail).not.toHaveBeenCalled();
  });

  it("enforces the 72h cooldown", async () => {
    mocks.prisma.signingRequest.findFirst.mockResolvedValue(
      stalledRequest({ manualReminderSentAt: new Date(Date.now() - 3600_000) }),
    );
    await expect(
      callerFor(alice).sendReminder({ dealRoomId: "deal-1" }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(mocks.sendSigningNudgeEmail).not.toHaveBeenCalled();
    expect(mocks.prisma.signingRequest.update).not.toHaveBeenCalled();
  });

  it("allows a new reminder once the cooldown has passed", async () => {
    mocks.prisma.signingRequest.findFirst.mockResolvedValue(
      stalledRequest({
        manualReminderSentAt: new Date(Date.now() - 73 * 3600_000),
      }),
    );
    const result = await callerFor(alice).sendReminder({ dealRoomId: "deal-1" });
    expect(result.success).toBe(true);
  });

  it("emails the lagging party, stamps the cooldown and writes an audit row", async () => {
    mocks.prisma.signingRequest.findFirst.mockResolvedValue(stalledRequest());

    const result = await callerFor(alice).sendReminder({ dealRoomId: "deal-1" });

    expect(result.success).toBe(true);
    expect(mocks.sendSigningNudgeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "bob@example.test",
        partyName: "Bob",
        senderName: "user-alice",
        dealName: "Stalled NDA",
        dealRoomId: "deal-1",
      }),
    );
    expect(mocks.prisma.signingRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sr-1" },
        data: { manualReminderSentAt: expect.any(Date) },
      }),
    );
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "SIGNING_REMINDER_SENT",
          details: { remindedRole: "RESPONDENT" },
        }),
      }),
    );
  });

  it("rejects when the signing is already completed", async () => {
    mocks.prisma.signingRequest.findFirst.mockResolvedValue(
      stalledRequest({ status: "COMPLETED" }),
    );
    await expect(
      callerFor(alice).sendReminder({ dealRoomId: "deal-1" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
