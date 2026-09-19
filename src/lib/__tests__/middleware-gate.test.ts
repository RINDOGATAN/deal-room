// The admin and supervisor gate must run on every request, including a
// visitor's first one (no cookies at all), and the currency cookie must still
// be written on whatever response the gate produces.
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../../middleware";

function run(path: string, cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return middleware(new NextRequest(`https://dealroom.todo.law${path}`, { headers }));
}

function setsCurrency(res: Response) {
  return res.headers.getSetCookie().some((c) => c.startsWith("currency="));
}

function redirectTarget(res: Response) {
  const location = res.headers.get("location");
  return location ? new URL(location).pathname : null;
}

describe("middleware gate, first visit (no cookies)", () => {
  it.each([
    ["/admin", "/admin/sign-in"],
    ["/admin/users", "/admin/sign-in"],
    ["/supervise", "/supervise/sign-in"],
    ["/supervise/deals", "/supervise/sign-in"],
  ])("redirects %s to %s and still sets the currency cookie", (path, target) => {
    const res = run(path);
    expect(res.status).toBe(307);
    expect(redirectTarget(res)).toBe(target);
    expect(setsCurrency(res)).toBe(true);
  });

  it.each(["/admin/sign-in", "/supervise/sign-in"])("allows %s", (path) => {
    const res = run(path);
    expect(res.status).toBe(200);
    expect(redirectTarget(res)).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(setsCurrency(res)).toBe(true);
  });

  it("lets an ordinary page through and sets the currency cookie", () => {
    const res = run("/deals");
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(redirectTarget(res)).toBeNull();
    const currency = res.headers.getSetCookie().find((c) => c.startsWith("currency="));
    // No country header: the visitor is not known to be outside the US.
    expect(currency).toMatch(/^currency=USD; /);
    expect(currency).toMatch(/Path=\//);
    expect(currency).toMatch(/Max-Age=2592000/);
  });

  it("sets EUR only for a visitor known to be outside the US", () => {
    const res = middleware(
      new NextRequest("https://dealroom.todo.law/deals", {
        headers: { "x-vercel-ip-country": "ES" },
      }),
    );
    expect(res.headers.getSetCookie().some((c) => c.startsWith("currency=EUR"))).toBe(true);
  });

  it("sets USD for a US visitor on a redirect too", () => {
    const res = middleware(
      new NextRequest("https://dealroom.todo.law/admin", {
        headers: { "x-vercel-ip-country": "US" },
      }),
    );
    expect(redirectTarget(res)).toBe("/admin/sign-in");
    expect(res.headers.getSetCookie().some((c) => c.startsWith("currency=USD"))).toBe(true);
  });
});

describe("middleware gate, 2FA", () => {
  it("sends an admin session without 2FA to /admin/verify (with or without currency)", () => {
    for (const cookie of ["admin_session=x", "currency=EUR; admin_session=x"]) {
      const res = run("/admin/users", cookie);
      expect(res.status).toBe(307);
      expect(redirectTarget(res)).toBe("/admin/verify");
    }
  });

  it("sends a supervisor session without 2FA to /supervise/verify", () => {
    const res = run("/supervise", "supervisor_session=x");
    expect(redirectTarget(res)).toBe("/supervise/verify");
  });

  it("lets a fully verified admin through without rewriting currency", () => {
    const res = run(
      "/admin/users",
      "currency=EUR; admin_session=x; platform_admin_2fa_verified=true",
    );
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(setsCurrency(res)).toBe(false);
  });
});

describe("middleware gate, locale clean-up alongside", () => {
  it("keeps the locale Set-Cookie headers next to the redirect and currency cookie", () => {
    const res = run("/admin", "locale=es; locale=en");
    expect(redirectTarget(res)).toBe("/admin/sign-in");
    const setCookies = res.headers.getSetCookie();
    expect(setCookies.filter((c) => c.startsWith("locale="))).toEqual([
      "locale=; Path=/; Max-Age=0; SameSite=Lax",
      "locale=en; Path=/; Max-Age=31536000; SameSite=Lax; Domain=.todo.law",
    ]);
    expect(setsCurrency(res)).toBe(true);
  });
});
