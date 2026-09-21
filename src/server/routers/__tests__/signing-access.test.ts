// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Signing access (cycle 12, F1).
 *
 * - The router exposes no "webhook" procedure: a signed-in user must not be
 *   able to record a signature or complete a signing by naming an externalId.
 * - getRequest is party-scoped, and a party receives only their own Firmas
 *   hand-off token (a bearer credential for that party's signing link).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";

const mocks = vi.hoisted(() => ({
  prisma: {
    dealRoomParty: { findFirst: vi.fn() },
    signingRequest: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    dealRoom: { update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
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
  sendSigningNudgeEmail: vi.fn(),
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
import { signingRouter, FIRMAS_TOKEN_REDACTED } from "@/server/routers/signing";

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

const request = {
  id: "sr-1",
  dealRoomId: "deal-1",
  externalId: "sign_1700000000000",
  status: "SENT",
  initiatorSignedAt: null,
  respondentSignedAt: null,
  initiatorFirmasToken: "token-of-the-initiator",
  respondentFirmasToken: "token-of-the-respondent",
  initiatorFirmasSentAt: null,
  respondentFirmasSentAt: null,
  initiatorSignedBundle: null,
  respondentSignedBundle: null,
  completedAt: null,
};

/** Party lookup keyed on the caller, the way the database would answer. */
function partiesAre(map: Record<string, "INITIATOR" | "RESPONDENT">) {
  mocks.prisma.dealRoomParty.findFirst.mockImplementation(
    async ({ where }: { where: { userId: string } }) =>
      map[where.userId] ? { id: `party-${where.userId}`, role: map[where.userId] } : null
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.signingRequest.findFirst.mockResolvedValue(request);
  mocks.prisma.signingRequest.findUnique.mockResolvedValue(request);
  partiesAre({ "user-alice": "INITIATOR", "user-bob": "RESPONDENT" });
});

describe("signing: no caller-driven webhook", () => {
  it("has no handleWebhook procedure", () => {
    expect(Object.keys(signingRouter._def.procedures)).not.toContain("handleWebhook");
  });

  it("a stranger cannot complete a signing by naming its externalId", async () => {
    const caller = callerFor(sessionFor("user-mallory")) as unknown as Record<
      string,
      ((input: unknown) => Promise<unknown>) | undefined
    >;
    const attempt = caller.handleWebhook;
    if (attempt) {
      await attempt({ externalId: request.externalId, event: "COMPLETED" }).catch(() => undefined);
    }
    expect(mocks.prisma.signingRequest.update).not.toHaveBeenCalled();
    expect(mocks.prisma.dealRoom.update).not.toHaveBeenCalled();
  });
});

describe("signing.getRequest", () => {
  it("refuses a signed-in user who is not a party", async () => {
    await expect(
      callerFor(sessionFor("user-mallory")).getRequest({ dealRoomId: "deal-1" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.prisma.signingRequest.findFirst).not.toHaveBeenCalled();
  });

  it("refuses an anonymous caller", async () => {
    await expect(callerFor(null).getRequest({ dealRoomId: "deal-1" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("gives the initiator their own token and only a marker for the other side", async () => {
    const result = await callerFor(sessionFor("user-alice")).getRequest({ dealRoomId: "deal-1" });
    expect(result?.id).toBe("sr-1");
    expect(result?.initiatorFirmasToken).toBe("token-of-the-initiator");
    expect(result?.respondentFirmasToken).toBe(FIRMAS_TOKEN_REDACTED);
  });

  it("gives the respondent their own token and only a marker for the other side", async () => {
    const result = await callerFor(sessionFor("user-bob")).getRequest({ dealRoomId: "deal-1" });
    expect(result?.respondentFirmasToken).toBe("token-of-the-respondent");
    expect(result?.initiatorFirmasToken).toBe(FIRMAS_TOKEN_REDACTED);
  });

  it("keeps an unset token null and still answers a party when no request exists", async () => {
    mocks.prisma.signingRequest.findFirst.mockResolvedValueOnce({
      ...request,
      respondentFirmasToken: null,
    });
    const result = await callerFor(sessionFor("user-alice")).getRequest({ dealRoomId: "deal-1" });
    expect(result?.respondentFirmasToken).toBeNull();

    mocks.prisma.signingRequest.findFirst.mockResolvedValueOnce(null);
    expect(
      await callerFor(sessionFor("user-alice")).getRequest({ dealRoomId: "deal-1" })
    ).toBeNull();
  });
});

describe("signing.firmasStatus", () => {
  it("does not hand a party the other side's token", async () => {
    const result = await callerFor(sessionFor("user-bob")).firmasStatus({ dealRoomId: "deal-1" });
    expect(result?.respondent.firmasToken).toBe("token-of-the-respondent");
    expect(result?.initiator.firmasToken).toBe(FIRMAS_TOKEN_REDACTED);
  });
});
