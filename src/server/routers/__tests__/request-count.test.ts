// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * lawyer.myRequestCount drives the footer's requests link (shown only once
 * the person has a request): it counts requests the person sent OR
 * received, only theirs, and needs a signed-in session.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";

const mocks = vi.hoisted(() => ({
  prisma: {
    recommendationRequest: { count: vi.fn() },
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

import { createInnerTRPCContext } from "@/server/trpc";
import { lawyerRouter } from "@/server/routers/lawyer";

function callerFor(userId: string | null) {
  const session: Session | null = userId
    ? {
        user: { id: userId, email: `${userId}@example.test`, name: userId, role: null },
        expires: new Date(Date.now() + 3600_000).toISOString(),
      }
    : null;
  return lawyerRouter.createCaller(
    createInnerTRPCContext({ session, adminSession: null, supervisorSession: null, getCookie: () => undefined }),
  );
}

beforeEach(() => {
  mocks.prisma.recommendationRequest.count.mockReset();
});

describe("lawyer.myRequestCount", () => {
  it("counts the requests the person sent or received", async () => {
    mocks.prisma.recommendationRequest.count.mockResolvedValue(2);
    await expect(callerFor("user-1").myRequestCount()).resolves.toBe(2);
    expect(mocks.prisma.recommendationRequest.count).toHaveBeenCalledWith({
      where: { OR: [{ requesterId: "user-1" }, { lawyerId: "user-1" }] },
    });
  });

  it("returns zero when there are none (the link stays hidden)", async () => {
    mocks.prisma.recommendationRequest.count.mockResolvedValue(0);
    await expect(callerFor("user-2").myRequestCount()).resolves.toBe(0);
  });

  it("needs a signed-in session", async () => {
    await expect(callerFor(null).myRequestCount()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.prisma.recommendationRequest.count).not.toHaveBeenCalled();
  });
});
