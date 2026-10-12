// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC
import { describe, it, expect, vi } from "vitest";

const { linkAccount } = vi.hoisted(() => ({ linkAccount: vi.fn() }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({ linkAccount }) }));
vi.mock("@/lib/prisma", () => ({ default: {}, prisma: {} }));
vi.mock("@/lib/email", () => ({ getResend: () => null }));

import { withoutOAuthTokens } from "@/lib/oauth-account";
import { adapter } from "@/lib/auth";

const googleAccount = {
  userId: "u1",
  type: "oauth" as const,
  provider: "google",
  providerAccountId: "123",
  access_token: "at",
  refresh_token: "rt",
  id_token: "it",
  expires_at: 1,
  token_type: "bearer",
  scope: "openid email",
};

describe("OAuth tokens are not stored", () => {
  it("withoutOAuthTokens drops the three tokens and keeps the rest", () => {
    const out = withoutOAuthTokens(googleAccount) as Record<string, unknown>;
    expect(out).not.toHaveProperty("access_token");
    expect(out).not.toHaveProperty("refresh_token");
    expect(out).not.toHaveProperty("id_token");
    expect(out).toMatchObject({ userId: "u1", provider: "google", providerAccountId: "123", scope: "openid email" });
    expect(googleAccount.access_token).toBe("at"); // input untouched
  });

  it("the auth adapter links the account without the tokens", async () => {
    await adapter!.linkAccount!(googleAccount);
    expect(linkAccount).toHaveBeenCalledTimes(1);
    const stored = linkAccount.mock.calls[0][0] as Record<string, unknown>;
    expect(stored.access_token).toBeUndefined();
    expect(stored.refresh_token).toBeUndefined();
    expect(stored.id_token).toBeUndefined();
    expect(stored.providerAccountId).toBe("123");
  });
});
