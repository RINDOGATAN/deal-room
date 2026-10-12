// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * invitation.accept is bound to the invited address: the signed-in account
 * must be the address the invitation was sent to (trimmed, any case). The
 * refusal does not repeat the invited address. No real DB is touched.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";

const mocks = vi.hoisted(() => ({
  prisma: {
    invitation: { findUnique: vi.fn(), update: vi.fn() },
    dealRoomParty: { update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ decode: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/email", () => ({ sendInvitationEmail: vi.fn() }));

import { createInnerTRPCContext } from "@/server/trpc";
import { invitationRouter } from "@/server/routers/invitation";

function callerAs(email: string | null) {
  const session: Session = {
    user: { id: "user-bob", email, name: "Bob", role: null },
    expires: new Date(Date.now() + 3_600_000).toISOString(),
  } as Session;
  return invitationRouter.createCaller(
    createInnerTRPCContext({ session, adminSession: null, supervisorSession: null, getCookie: () => undefined }),
  );
}

const INVITED = "Counterparty@Example.test";

function pendingInvitation() {
  return {
    id: "inv-1",
    dealRoomId: "deal-1",
    email: INVITED,
    token: "tok",
    status: "PENDING",
    expiresAt: new Date(Date.now() + 86_400_000),
    dealRoom: {
      parties: [
        { id: "p-init", role: "INITIATOR", userId: "user-alice" },
        { id: "p-resp", role: "RESPONDENT", userId: null },
      ],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.invitation.findUnique.mockResolvedValue(pendingInvitation());
  mocks.prisma.invitation.update.mockResolvedValue({});
  mocks.prisma.dealRoomParty.update.mockResolvedValue({});
  mocks.prisma.auditLog.create.mockResolvedValue({});
});

describe("invitation.accept", () => {
  it("accepts when the signed-in address is the invited one, ignoring case and spaces", async () => {
    const result = await callerAs("  counterparty@example.TEST ").accept({ token: "tok" });
    expect(result).toEqual({ dealRoomId: "deal-1" });
    expect(mocks.prisma.dealRoomParty.update).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.invitation.update).toHaveBeenCalledTimes(1);
  });

  it("refuses another address without linking the party or revealing the invited address", async () => {
    const err = (await callerAs("someone-else@example.test")
      .accept({ token: "tok" })
      .then(() => null, (e: unknown) => e)) as { code: string; message: string };
    expect(err).toMatchObject({ code: "FORBIDDEN" });
    expect(err.message.toLowerCase()).not.toContain("counterparty@example.test");
    expect(mocks.prisma.dealRoomParty.update).not.toHaveBeenCalled();
    expect(mocks.prisma.invitation.update).not.toHaveBeenCalled();
  });

  it("refuses a session without an address", async () => {
    await expect(callerAs(null).accept({ token: "tok" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.prisma.dealRoomParty.update).not.toHaveBeenCalled();
  });
});
