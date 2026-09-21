import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { localeCleanupSetCookies } from "@/lib/locale-cookie";
import { currencyForCountry } from "@/lib/currency";
import { isHostedPilotEnv } from "@/lib/pilot";
import { readAdminSession, readSupervisorSession } from "@/lib/portal-session";
import { SECOND_FACTOR_COOKIE, verifySecondFactor } from "@/lib/portal-2fa";

export async function middleware(request: NextRequest) {
  const response = await route(request);

  // Collapse duplicate / legacy language cookies into the single shared
  // `locale` cookie. Never writes a default when the visitor has not chosen.
  for (const cookie of localeCleanupSetCookies(
    request.headers.get("cookie"),
    request.nextUrl.hostname,
  )) {
    response.headers.append("Set-Cookie", cookie);
  }

  return response;
}

async function route(request: NextRequest) {
  // The access checks decide the response first, so no visitor (not even
  // one on a first request, with no cookies yet) can skip them.
  const response = await gate(request);

  // Set currency cookie based on geo-IP (a known non-US country → EUR,
  // otherwise USD), on whatever response the gate produced, redirects included.
  if (!request.cookies.has("currency")) {
    const currency = currencyForCountry(request.headers.get("x-vercel-ip-country"));
    response.cookies.set("currency", currency, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
    });
  }

  return response;
}

/**
 * Hosted pilot: nothing is sold, so the billing page must not be reachable.
 * The `notFound()` in `(dashboard)/billing/layout.tsx` still answers 200
 * under the client dashboard layout, so the pilot redirects here instead,
 * to Settings (the pilot's account page). Read per request: the kit never
 * matches and keeps the layout's own gate.
 */
function hostedPilot() {
  return isHostedPilotEnv({
    NEXT_PUBLIC_HOSTED_PILOT: process.env.NEXT_PUBLIC_HOSTED_PILOT,
    VERCEL_ENV: process.env.VERCEL_ENV,
    AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN,
  });
}

async function gate(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if ((path === "/billing" || path.startsWith("/billing/")) && hostedPilot()) {
    return NextResponse.redirect(new URL("/settings", request.url));
  }

  // Supervisor portal protection
  if (path.startsWith("/supervise")) {
    // Allow auth pages
    if (
      path.includes("/sign-in") ||
      path.includes("/verify-request") ||
      path.includes("/verify") ||
      path.includes("/error")
    ) {
      return NextResponse.next();
    }

    // A supervisor session is a token issued by the supervisor sign-in. A
    // missing cookie, or a token from another portal, goes to sign-in.
    const supervisorSession = await readSupervisorSession(
      request.cookies.get("supervisor_session")?.value
    );
    if (!supervisorSession) {
      return NextResponse.redirect(new URL("/supervise/sign-in", request.url));
    }

    // The 2FA cookie must be the signed value issued for this supervisor and
    // this sign-in, not yet expired.
    const supervisor2FA = await verifySecondFactor(
      "supervisor",
      supervisorSession.supervisorId,
      supervisorSession.sid,
      request.cookies.get(SECOND_FACTOR_COOKIE.supervisor)?.value
    );
    if (!supervisor2FA) {
      return NextResponse.redirect(new URL("/supervise/verify", request.url));
    }
  }

  // Platform admin portal protection
  if (path.startsWith("/admin")) {
    // Allow auth pages
    if (
      path.includes("/sign-in") ||
      path.includes("/verify-request") ||
      path.includes("/verify") ||
      path.includes("/error")
    ) {
      return NextResponse.next();
    }

    // An admin session is a token issued by the admin sign-in. A missing
    // cookie, or a token from another portal, goes to sign-in.
    const adminSession = await readAdminSession(request.cookies.get("admin_session")?.value);
    if (!adminSession) {
      return NextResponse.redirect(new URL("/admin/sign-in", request.url));
    }

    // The 2FA cookie must be the signed value issued for this admin and this
    // sign-in, not yet expired.
    const admin2FA = await verifySecondFactor(
      "admin",
      adminSession.adminId,
      adminSession.sid,
      request.cookies.get(SECOND_FACTOR_COOKIE.admin)?.value
    );
    if (!admin2FA) {
      return NextResponse.redirect(new URL("/admin/verify", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon).*)",
  ],
};
