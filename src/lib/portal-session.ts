// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Session tokens for the admin and supervisor portals.
 *
 * The user portal and the two privileged portals share NEXTAUTH_SECRET. With
 * the library's default (empty) salt all three derive the same encryption
 * key, so a token issued by the ordinary sign-in decoded in the admin cookie.
 * Each privileged portal therefore derives its own key from a distinct salt:
 * a token that was not issued by that portal's own sign-in does not decrypt.
 *
 * Every reader of `admin_session` / `supervisor_session` goes through this
 * module. It fails closed: no secret, no token, a token from another portal
 * or a token without the portal's identity claim all read as "no session".
 *
 * Edge-safe (next-auth/jwt only), so middleware can use it.
 */

import { encode, decode, type JWT, type JWTOptions } from "next-auth/jwt";

export const ADMIN_PORTAL_SALT = "dealroom.admin-portal.v1";
export const SUPERVISOR_PORTAL_SALT = "dealroom.supervisor-portal.v1";

/** `jwt` option for a portal's NextAuthOptions: issue and read with its salt. */
export function portalJwtOptions(salt: string): Partial<JWTOptions> {
  return {
    encode: (params) => encode({ ...params, salt }),
    decode: (params) => decode({ ...params, salt }),
  };
}

async function decodePortalToken(
  token: string | undefined,
  salt: string
): Promise<JWT | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!token || !secret) return null;
  try {
    return await decode({ token, secret, salt });
  } catch {
    return null;
  }
}

/**
 * `sid` identifies one sign-in: a random id stamped into the token by the
 * portal's jwt callback and carried unchanged through re-issues. The second
 * factor is bound to it (portal-2fa.ts). Null on a token that has none, in
 * which case no second factor can verify.
 */
export type AdminPortalSession = { email: string; adminId: string; sid: string | null };
export type SupervisorPortalSession = { email: string; supervisorId: string; sid: string | null };

/** A fresh session id, for the jwt callbacks at sign-in. */
export function newPortalSessionId(): string {
  return crypto.randomUUID();
}

function sidOf(decoded: JWT): string | null {
  return typeof decoded.sid === "string" && decoded.sid ? decoded.sid : null;
}

export async function readAdminSession(
  token: string | undefined
): Promise<AdminPortalSession | null> {
  const decoded = await decodePortalToken(token, ADMIN_PORTAL_SALT);
  if (typeof decoded?.email !== "string" || typeof decoded?.adminId !== "string") {
    return null;
  }
  return { email: decoded.email, adminId: decoded.adminId, sid: sidOf(decoded) };
}

export async function readSupervisorSession(
  token: string | undefined
): Promise<SupervisorPortalSession | null> {
  const decoded = await decodePortalToken(token, SUPERVISOR_PORTAL_SALT);
  if (typeof decoded?.email !== "string" || typeof decoded?.supervisorId !== "string") {
    return null;
  }
  return { email: decoded.email, supervisorId: decoded.supervisorId, sid: sidOf(decoded) };
}
