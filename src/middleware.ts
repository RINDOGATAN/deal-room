import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Get locale from cookie, default to 'en'
  const locale = request.cookies.get("NEXT_LOCALE")?.value || "en";

  // Clone the response and set the locale header for next-intl
  const response = NextResponse.next();

  // Set the locale in a header that next-intl can read
  response.headers.set("x-next-intl-locale", locale);

  return response;
}

export const config = {
  // Match all routes except API routes, static files, and Next.js internals
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
