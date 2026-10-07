// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Own lawyer only (owner's decision, 6 October 2026): a technology company
 * that lists lawyers and states their fee looks like a lawyer referral
 * service, so parties never pick from a platform list.
 *
 * - No procedure lists lawyers to a party (Stage A or Stage B), and no
 *   party procedure accepts a platform-chosen supervisor id.
 * - The in-app invitation works with `features.startupCoverage` off.
 * - Stage B names the joint closing lawyer by e-mail.
 * - The flat fee note is gone from the messages and the review page.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";

const mocks = vi.hoisted(() => ({
  prisma: {
    dealRoomParty: { findFirst: vi.fn() },
  },
  inviteOwnLawyer: vi.fn(),
  requestJointCounsel: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ decode: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => ({ get: () => null }),
}));
vi.mock("@/lib/email", () => ({}));
// The flag is OFF here: the invitation must not depend on it.
vi.mock("@/config/features", () => ({ features: { startupCoverage: false } }));
vi.mock("@/server/services/attorney/ownLawyer", () => ({ inviteOwnLawyer: mocks.inviteOwnLawyer }));
vi.mock("@/server/services/attorney/jointCounsel", () => ({ requestJointCounsel: mocks.requestJointCounsel }));

import { createInnerTRPCContext } from "@/server/trpc";
import { attorneyReviewRouter } from "@/server/routers/attorneyReview";
import { jointCounselRouter } from "@/server/routers/jointCounsel";

const session: Session = {
  user: { id: "user-1", email: "user-1@example.test", name: "user-1", role: null },
  expires: new Date(Date.now() + 3600_000).toISOString(),
};

function ctx() {
  return createInnerTRPCContext({
    session,
    adminSession: null,
    supervisorSession: null,
    getCookie: () => undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.dealRoomParty.findFirst.mockResolvedValue({ id: "party-1" });
});

describe("no list of lawyers for parties", () => {
  it("attorneyReview has no list and no request by supervisor id", () => {
    const procs = Object.keys(attorneyReviewRouter._def.procedures);
    expect(procs).not.toContain("listAvailableAttorneys");
    expect(procs).not.toContain("requestReview");
    expect(procs).toContain("inviteOwnLawyer");
  });

  it("jointCounsel has no list", () => {
    const procs = Object.keys(jointCounselRouter._def.procedures);
    expect(procs).not.toContain("listAvailable");
    expect(procs).toContain("request");
  });

  it("jointCounsel.request refuses a supervisor id in place of an e-mail", async () => {
    const caller = jointCounselRouter.createCaller(ctx());
    await expect(
      caller.request({ dealRoomId: "deal-1", supervisorId: "sup-1" } as never),
    ).rejects.toThrow();
    expect(mocks.requestJointCounsel).not.toHaveBeenCalled();
  });
});

describe("invite your own lawyer with the startupCoverage flag off", () => {
  it("invites the lawyer", async () => {
    mocks.inviteOwnLawyer.mockResolvedValue({ ok: true, supervisorId: "sup-1", lawyerEmail: "counsel@lawyers.example", emailSent: true });
    const caller = attorneyReviewRouter.createCaller(ctx());
    const r = await caller.inviteOwnLawyer({ dealRoomId: "deal-1", email: "counsel@lawyers.example" });
    expect(r).toEqual({ success: true, emailSent: true });
    expect(mocks.inviteOwnLawyer).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      partyId: "party-1",
      lawyerEmail: "counsel@lawyers.example",
      via: "app",
    }));
  });
});

describe("Stage B by e-mail", () => {
  it("passes the named lawyer to the service", async () => {
    mocks.requestJointCounsel.mockResolvedValue({ ok: true, supervisorId: "sup-2", lawyerEmail: "closing@lawyers.example", emailSent: true });
    const caller = jointCounselRouter.createCaller(ctx());
    const r = await caller.request({ dealRoomId: "deal-1", email: "closing@lawyers.example", name: "B. Counsel", lang: "es" });
    expect(r).toEqual({ success: true, emailSent: true });
    expect(mocks.requestJointCounsel).toHaveBeenCalledWith(expect.anything(), {
      partyId: "party-1",
      lawyerEmail: "closing@lawyers.example",
      lawyerName: "B. Counsel",
      actorUserId: "user-1",
      lang: "es",
    });
  });

  it("maps a service refusal to a tRPC error", async () => {
    mocks.requestJointCounsel.mockResolvedValue({ ok: false, status: 403, code: "NOT_INITIATOR", error: "Only the initiator can request joint closing counsel" });
    const caller = jointCounselRouter.createCaller(ctx());
    await expect(caller.request({ dealRoomId: "deal-1", email: "closing@lawyers.example" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("no flat fee note", () => {
  const root = process.cwd();
  it("is gone from the messages", () => {
    for (const lang of ["en", "es"]) {
      const raw = readFileSync(path.join(root, "src/messages", `${lang}.json`), "utf8");
      expect(raw).not.toContain("attorneyReviewPriceNote");
      expect(raw).not.toMatch(/flat fee of|tarifa fija de \{price\}/);
    }
  });
  it("is not rendered on the review page", () => {
    const page = readFileSync(path.join(root, "src/app/(dashboard)/deals/[id]/review/page.tsx"), "utf8");
    expect(page).not.toContain("attorneyReviewPriceNote");
    expect(page).not.toMatch(/\$200|200 €/);
    expect(page).not.toContain("listAvailable");
    expect(page).not.toContain("features.startupCoverage");
  });
});
