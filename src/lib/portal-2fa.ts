// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The second-factor gate for /admin and /supervise.
 *
 * The gate cookie used to hold the fixed string "true", which the holder of a
 * first-factor session could set by hand. It is now a signed value:
 *
 *   v1.<expiry, unix seconds>.<HMAC-SHA256 over portal | subject id | session id | expiry>
 *
 * - bound to the admin or supervisor id and to the sign-in it was issued for
 *   (`sid`, a random id stamped into the session token at sign-in), so it is
 *   worthless next to any other session;
 * - the expiry is inside the signature, so editing the cookie's lifetime in
 *   the browser does nothing;
 * - keyed with NEXTAUTH_SECRET. No secret, no session id, a malformed value or
 *   an expired one all verify as false.
 *
 * One helper, used by the middleware, both tRPC routers and the supervisor
 * document routes. Edge-safe (Web Crypto only).
 */

export type Portal = "admin" | "supervisor";

export const SECOND_FACTOR_COOKIE: Record<Portal, string> = {
  admin: "platform_admin_2fa_verified",
  supervisor: "supervisor_2fa_verified",
};

/** Lifetime of a verified second factor. */
export const SECOND_FACTOR_MAX_AGE_SECONDS = 4 * 60 * 60;

const encoder = new TextEncoder();

async function signingKey(usage: "sign" | "verify"): Promise<CryptoKey | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage]
  );
}

function message(portal: Portal, subjectId: string, sid: string, expiry: number) {
  return encoder.encode(["dealroom.2fa.v1", portal, subjectId, sid, String(expiry)].join("|"));
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** Issue the cookie value after a TOTP code has been verified server-side. */
export async function issueSecondFactor(
  portal: Portal,
  subjectId: string,
  sid: string,
  nowMs: number = Date.now()
): Promise<string> {
  const key = await signingKey("sign");
  if (!key || !subjectId || !sid) {
    throw new Error("Second factor cannot be issued without a secret, a subject and a session id");
  }
  const expiry = Math.floor(nowMs / 1000) + SECOND_FACTOR_MAX_AGE_SECONDS;
  const signature = await crypto.subtle.sign("HMAC", key, message(portal, subjectId, sid, expiry));
  return `v1.${expiry}.${toBase64Url(signature)}`;
}

/** True only for a value this server issued for this subject and this session, not yet expired. */
export async function verifySecondFactor(
  portal: Portal,
  subjectId: string | null | undefined,
  sid: string | null | undefined,
  value: string | null | undefined,
  nowMs: number = Date.now()
): Promise<boolean> {
  if (!subjectId || !sid || !value) return false;

  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || !/^\d{1,12}$/.test(parts[1])) return false;

  const expiry = Number(parts[1]);
  if (expiry <= Math.floor(nowMs / 1000)) return false;

  const signature = fromBase64Url(parts[2]);
  if (!signature) return false;

  const key = await signingKey("verify");
  if (!key) return false;

  // subtle.verify compares in constant time.
  return crypto.subtle.verify("HMAC", key, signature, message(portal, subjectId, sid, expiry));
}
