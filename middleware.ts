import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { localeCleanupSetCookies } from "@/lib/locale-cookie";
import { currencyForCountry } from "@/lib/currency";
import { isHostedPilotEnv } from "@/lib/pilot";

export function middleware(request: NextRequest) {
  const response = route(request);

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

function route(request: NextRequest) {
  // The access checks decide the response first, so no visitor (not even
  // one on a first request, with no cookies yet) can skip them.
  const response = gate(request);

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

function gate(request: NextRequest) {
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

    // Check for supervisor session cookie
    const supervisorSession = request.cookies.get("supervisor_session");
    if (!supervisorSession) {
      return NextResponse.redirect(new URL("/supervise/sign-in", request.url));
    }

    // Check for 2FA verification cookie
    const supervisor2FA = request.cookies.get("supervisor_2fa_verified");
    if (supervisor2FA?.value !== "true") {
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

    // Check for admin session cookie
    const adminSession = request.cookies.get("admin_session");
    if (!adminSession) {
      return NextResponse.redirect(new URL("/admin/sign-in", request.url));
    }

    // Check for 2FA verification cookie
    const admin2FA = request.cookies.get("platform_admin_2fa_verified");
    if (admin2FA?.value !== "true") {
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
