import { NextResponse } from "next/server";

const isProduction = process.env.NODE_ENV === "production";

// All session cookie names used across todo.law apps
const CROSS_APP_COOKIES = [
  // Dealroom + DPO Central (NextAuth v4)
  "__Secure-next-auth.session-token",
  "__Secure-next-auth.callback-url",
  "next-auth.session-token",
  "next-auth.callback-url",
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
  const domain = isProduction ? ".todo.law" : undefined;

  for (const name of CROSS_APP_COOKIES) {
    response.cookies.set(name, "", {
      expires: new Date(0),
      path: "/",
      ...(domain && { domain }),
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
    });
  }

  return response;
}
