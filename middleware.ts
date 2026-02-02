import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
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
    "/supervise/:path*",
    "/admin/:path*",
  ],
};
