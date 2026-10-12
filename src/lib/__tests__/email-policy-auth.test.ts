// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Server-side enforcement of the account e-mail policy at sign-in:
 * the NextAuth route answers 400 before a magic link is sent or a user is
 * created, and the signIn callback refuses Google (and any other provider)
 * with the auth error page's EmailNotAccepted code.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/features", () => ({
  features: { localAuth: false, magicLinkAuth: true, inviteCodeAuth: false },
}));
vi.mock("@/lib/email", () => ({
  getResend: () => {
    throw new Error("no mailer in tests");
  },
}));
vi.mock("@/lib/prisma", () => ({ default: { user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() } } }));

import { authOptions } from "@/lib/auth";
import { withAccountEmailPolicy } from "@/lib/email-policy-server";

const BASE = "https://app.example.test/api/auth";

function formPost(path: string, email: string, cookie?: string) {
  return new Request(`${BASE}/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(cookie ? { cookie } : {}),
    },
    body: new URLSearchParams({ email, csrfToken: "t", json: "true" }),
  });
}

describe("withAccountEmailPolicy (NextAuth route)", () => {
  const inner = vi.fn(async () => new Response("passed", { status: 200 }));
  const handler = withAccountEmailPolicy(inner);

  it.each([
    ["signin/email", "b.ake.r.miche.ll.eba.hpc.y.jx@gmail.com"],
    ["signin/email", "SOMEONE@HOTMAIL.COM"],
    ["signin/email", "x@aol.co.uk"],
    ["callback/local", "a.b.c.d@GOOGLEMAIL.com"],
    ["callback/invite-code", "x@hotmail.fr"],
  ])("answers 400 to POST %s for %s, without reaching NextAuth", async (path, email) => {
    inner.mockClear();
    const res = await handler(formPost(path, email), {});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("email_not_accepted");
    expect(body.message).toBe(
      "Please use your work e-mail address, or a different personal address. We can't accept this one.",
    );
    expect(new URL(body.url).searchParams.get("error")).toBe("EmailNotAccepted");
    expect(inner).not.toHaveBeenCalled();
  });

  it("answers in Spanish when the visitor chose Spanish", async () => {
    const res = await handler(formPost("signin/email", "x@hotmail.com", "locale=es"), {});
    expect((await res.json()).message).toBe(
      "Usa tu correo del trabajo u otra dirección personal. No podemos aceptar esta.",
    );
  });

  it("reads a JSON body too", async () => {
    const req = new Request(`${BASE}/signin/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "x@aol.com" }),
    });
    expect((await handler(req, {})).status).toBe(400);
  });

  it.each(["first.last@gmail.com", "FIRST.LAST@GMAIL.COM", "name@company.example"])(
    "passes %s through to NextAuth",
    async (email) => {
      inner.mockClear();
      const res = await handler(formPost("signin/email", email), {});
      expect(res.status).toBe(200);
      expect(inner).toHaveBeenCalledTimes(1);
    },
  );

  it("leaves GET requests and other POSTs alone", async () => {
    inner.mockClear();
    await handler(new Request(`${BASE}/session`), {});
    await handler(formPost("signout", "x@hotmail.com"), {});
    expect(inner).toHaveBeenCalledTimes(2);
  });
});

describe("signIn callback (Google and every provider)", () => {
  const signIn = authOptions.callbacks!.signIn!;
  const run = (email: string) =>
    signIn({ user: { id: "u", email }, account: { provider: "google" } } as never);

  it.each(["x@hotmail.com", "X@AOL.DE", "B.AKE.R.MICHE.LL.EBA.HPC.Y.JX@GMAIL.COM"])(
    "sends %s to the auth error page",
    async (email) => {
      expect(await run(email)).toBe("/auth-error?error=EmailNotAccepted");
    },
  );

  it.each(["first.last@gmail.com", "FIRST.LAST@GMAIL.COM", "name@company.example"])(
    "lets %s in",
    async (email) => {
      expect(await run(email)).toBe(true);
    },
  );
});
