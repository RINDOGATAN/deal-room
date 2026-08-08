// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Self-host session hygiene.
 *
 * On the suite, all apps run on localhost (cookies are per-host, not per
 * port) and share one NEXTAUTH_SECRET, so a sibling app's JWT decodes here
 * carrying a user id that only exists in the sibling's database. Before the
 * fix, every DB write for such a session died on a foreign-key violation
 * ("Failed to create deal: An unexpected error occurred").
 *
 * Two defenses under features.localAuth:
 *  1. App-prefixed cookie names (`dealroom.session-token`) so sibling apps
 *     can no longer overwrite our session cookie at all.
 *  2. The jwt callback re-anchors a token whose sub is unknown locally by
 *     email — the same find-or-create the local sign-in provider performs —
 *     and clears the sub when there is nothing to re-anchor with.
 * Plus a runtime guard: a session without a user id is UNAUTHORIZED.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/config/features", () => ({
  features: {
    localAuth: true,
    magicLinkAuth: false,
    inviteCodeAuth: false,
  },
}));

vi.mock("@/lib/email", () => ({
  getResend: () => {
    throw new Error("no mailer in tests");
  },
}));

const mockUserFindUnique = vi.fn();
const mockUserCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      create: (...args: unknown[]) => mockUserCreate(...args),
      update: vi.fn(),
    },
  },
}));

import { authOptions } from "@/lib/auth";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";

type JwtCallback = NonNullable<NonNullable<typeof authOptions.callbacks>["jwt"]>;
const jwtCallback = authOptions.callbacks!.jwt! as JwtCallback;

function runJwt(token: Record<string, unknown>, user?: { id: string }) {
  return jwtCallback({ token, user, trigger: undefined } as never);
}

beforeEach(() => {
  mockUserFindUnique.mockReset();
  mockUserCreate.mockReset();
});

describe("self-host cookie scoping", () => {
  it("uses dealroom-prefixed cookie names under localAuth", () => {
    expect(authOptions.cookies?.sessionToken?.name).toBe("dealroom.session-token");
    expect(authOptions.cookies?.callbackUrl?.name).toBe("dealroom.callback-url");
    expect(authOptions.cookies?.csrfToken?.name).toBe("dealroom.csrf-token");
  });
});

describe("jwt callback re-anchoring", () => {
  it("leaves a token alone when its sub exists locally", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: "local-1" });
    const token = await runJwt({ sub: "local-1", email: "a@nel.test" });
    expect(token.sub).toBe("local-1");
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it("remaps a foreign sub to the local user with the same email", async () => {
    mockUserFindUnique.mockImplementation(async (args) => {
      const where = (args as { where: { id?: string; email?: string } }).where;
      if (where.id === "foreign-1") return null; // not in this app's DB
      if (where.email === "a@nel.test") return { id: "local-1", role: "LAWYER" };
      return null;
    });
    const token = await runJwt({ sub: "foreign-1", email: "A@nel.test " });
    expect(token.sub).toBe("local-1");
    expect(token.role).toBe("LAWYER");
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it("creates the local user when the email is unknown (local-auth semantics)", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockUserCreate.mockResolvedValueOnce({ id: "created-1", role: null });
    const token = await runJwt({ sub: "foreign-1", email: "new@nel.test" });
    expect(mockUserCreate).toHaveBeenCalledWith({
      data: { email: "new@nel.test", emailVerified: expect.any(Date) },
    });
    expect(token.sub).toBe("created-1");
  });

  it("clears the sub when a foreign token has no email to re-anchor with", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const token = await runJwt({ sub: "foreign-1" });
    expect(token.sub).toBeUndefined();
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it("skips the guard on fresh sign-in (the provider just verified the user)", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ role: null }); // role lookup
    const token = await runJwt({ sub: "local-1", email: "a@nel.test" }, { id: "local-1" });
    expect(token.sub).toBe("local-1");
    expect(mockUserCreate).not.toHaveBeenCalled();
    expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
  });
});

describe("protectedProcedure runtime id guard", () => {
  const router = createTRPCRouter({
    ping: protectedProcedure.query(() => "pong"),
  });

  it("rejects a session whose user has no id", async () => {
    const caller = router.createCaller({
      session: { user: { email: "a@nel.test" }, expires: "" },
    } as never);
    await expect(caller.ping()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("admits a session with a user id", async () => {
    const caller = router.createCaller({
      session: { user: { id: "local-1", email: "a@nel.test" }, expires: "" },
    } as never);
    await expect(caller.ping()).resolves.toBe("pong");
  });
});
