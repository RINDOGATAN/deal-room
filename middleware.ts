import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { localeCleanupSetCookies } from "@/lib/locale-cookie";
import { REGION_COOKIE, regionCurrency } from "@/lib/currency";
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

  // The region guess for the browser (EU member state → EUR, otherwise
  // USD; see `src/lib/currency.ts`), on whatever response the gate
  // produced, redirects included. A session cookie, re-evaluated on every
  // page request and rewritten whenever it differs, so a cookie written
  // under an earlier rule is corrected on the next page load.
  const currency = regionCurrency({
    country: request.headers.get("x-vercel-ip-country"),
    acceptLanguage: request.headers.get("accept-language"),
  });
  if (request.cookies.get(REGION_COOKIE)?.value !== currency) {
    response.cookies.set(REGION_COOKIE, currency, { path: "/", sameSite: "lax" });
  }

  return response;
}

async function gate(request: NextRequest) {
  const path = request.nextUrl.pathname;

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
