// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextResponse } from "next/server";
import { brand } from "@/config/brand";
import { resolveAuthCookiePolicy } from "@/lib/auth-cookie-policy";

// All session cookie names used across todo.law apps
const CROSS_APP_COOKIES = [
  // Dealroom + DPO Central (NextAuth v4)
  "__Secure-next-auth.session-token",
  "__Secure-next-auth.callback-url",
  "next-auth.session-token",
  "next-auth.callback-url",
  // Dealroom self-host posture (unique prefix — avoids the localhost
  // cross-app cookie collision on the suite)
  "__Secure-dealroom.session-token",
  "__Secure-dealroom.callback-url",
  "dealroom.session-token",
  "dealroom.callback-url",
  // DPO Central self-host posture (same collision fix, its repo)
  "__Secure-dpocentral.session-token",
  "__Secure-dpocentral.callback-url",
  "dpocentral.session-token",
  "dpocentral.callback-url",
  // AI Sentinel (NextAuth v4, unique prefix)
  "__Secure-aisentinel.session-token",
  "__Secure-aisentinel.callback-url",
  "aisentinel.session-token",
  "aisentinel.callback-url",
  // Seneca (NextAuth v5)
  "__Secure-authjs.session-token",
  "__Secure-authjs.callback-url",
  "authjs.session-token",
  "authjs.callback-url",
];

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // Same secure flag and domain as the sign-in set (auth-cookie-policy.ts):
  // a removal with any other domain leaves the session cookie in place.
  const { secure, domain } = resolveAuthCookiePolicy(process.env, brand.cookieDomain);

  for (const name of CROSS_APP_COOKIES) {
    response.cookies.set(name, "", {
      expires: new Date(0),
      path: "/",
      ...(domain && { domain }),
      httpOnly: true,
      secure,
      sameSite: "lax",
    });
  }

  return response;
}
