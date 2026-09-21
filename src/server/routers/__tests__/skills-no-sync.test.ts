// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * No catalogue sync over the API (cycle 12, F4).
 *
 * `skills.sync` was a protectedProcedure: any signed-in user could trigger
 * `syncSkillsToDatabase`, which deletes every clause template of each
 * built-in skill before recreating it. Nothing called it, so it is gone. The
 * catalogue is refreshed by the seed, which reconciles instead of deleting.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";

const mocks = vi.hoisted(() => ({
  syncSkillsToDatabase: vi.fn(),
  contractTemplateFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const prisma = { contractTemplate: { findMany: mocks.contractTemplateFindMany } };
  return { default: prisma, prisma };
});
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => ({ get: () => null }),
}));
vi.mock("@/server/services/skills/loader", () => ({
  syncSkillsToDatabase: mocks.syncSkillsToDatabase,
}));

import { createInnerTRPCContext } from "@/server/trpc";
import { skillsRouter } from "@/server/routers/skills";

const stranger: Session = {
  user: { id: "user-mallory", email: "mallory@example.test", name: "Mallory", role: null },
  expires: new Date(Date.now() + 3600_000).toISOString(),
};

function callerFor(session: Session | null) {
  return skillsRouter.createCaller(
    createInnerTRPCContext({
      session,
      adminSession: null,
      supervisorSession: null,
      getCookie: () => undefined,
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.contractTemplateFindMany.mockResolvedValue([]);
});

describe("skills router", () => {
  it("has no sync procedure", () => {
    expect(Object.keys(skillsRouter._def.procedures)).not.toContain("sync");
  });

  it("a signed-in user cannot start a catalogue rewrite", async () => {
    const caller = callerFor(stranger) as unknown as Record<
      string,
      (() => Promise<unknown>) | undefined
    >;
    await caller.sync?.().catch(() => undefined);
    expect(mocks.syncSkillsToDatabase).not.toHaveBeenCalled();
  });

  it("still serves the public template list", async () => {
    await expect(callerFor(null).listTemplates()).resolves.toEqual([]);
  });
});
