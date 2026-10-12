// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Server-side enforcement of the e-mail policy (see email-policy.ts).
 *
 * - `EmailNotAcceptedError`: thrown from tRPC procedures; the tRPC error
 *   formatter exposes `data.messageKey = "email_not_accepted"` and the
 *   route answers HTTP 400 (code BAD_REQUEST).
 * - `withAccountEmailPolicy`: wraps a NextAuth route handler and answers
 *   400 to a sign-in POST whose e-mail is refused, before NextAuth sends a
 *   magic link or creates a user.
 * - `AUTH_ERROR_EMAIL_NOT_ACCEPTED`: the NextAuth error code shown on the
 *   auth error page (Google sign-in refusals arrive there).
 */

import { TRPCError } from "@trpc/server";
import {
  BLOCKED_EMAIL_MESSAGE_KEY,
  blockedEmailMessage,
  isBlockedAccountEmail,
} from "@/lib/email-policy";
import { resolveChosenLocale } from "@/lib/locale-cookie";

export const AUTH_ERROR_EMAIL_NOT_ACCEPTED = "EmailNotAccepted";

export class EmailNotAcceptedError extends Error {
  readonly messageKey = BLOCKED_EMAIL_MESSAGE_KEY;
  constructor(locale?: string | null) {
    super(blockedEmailMessage(locale));
    this.name = "EmailNotAcceptedError";
  }
}

/** Throws a BAD_REQUEST tRPC error when the address may not hold an account. */
export function assertAccountEmailAllowed(email: string, locale?: string | null): void {
  if (!isBlockedAccountEmail(email)) return;
  const cause = new EmailNotAcceptedError(locale);
  throw new TRPCError({ code: "BAD_REQUEST", message: cause.message, cause });
}

/** The 400 body every REST surface answers with. */
export function emailNotAcceptedBody(locale?: string | null, url?: string) {
  return {
    error: BLOCKED_EMAIL_MESSAGE_KEY,
    message: blockedEmailMessage(locale),
    ...(url ? { url } : {}),
  };
}

/** The visitor's chosen locale from a cookie getter (tRPC context). */
export function localeFromCookies(getCookie: (name: string) => string | undefined): string {
  return getCookie("locale") ?? getCookie("NEXT_LOCALE") ?? "en";
}

/** The tRPC error for a refused address, from a service's failure result. */
export function emailNotAcceptedTrpcError(message: string, locale?: string | null): TRPCError {
  return new TRPCError({ code: "BAD_REQUEST", message, cause: new EmailNotAcceptedError(locale) });
}

export function localeFromRequest(req: Request): string {
  const chosen = resolveChosenLocale(req.headers.get("cookie"));
  if (chosen) return chosen;
  const accept = req.headers.get("accept-language") ?? "";
  return accept.trim().toLowerCase().startsWith("es") ? "es" : "en";
}

/** The e-mail field of a NextAuth sign-in POST (form-encoded or JSON). */
async function emailFromAuthPost(req: Request): Promise<string | null> {
  try {
    const type = req.headers.get("content-type") ?? "";
    const text = await req.clone().text();
    if (type.includes("application/json")) {
      const body = JSON.parse(text) as { email?: unknown };
      return typeof body.email === "string" ? body.email : null;
    }
    return new URLSearchParams(text).get("email");
  } catch {
    return null;
  }
}

function isSignInPost(req: Request): boolean {
  if (req.method.toUpperCase() !== "POST") return false;
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  const action = segments[segments.length - 2];
  return action === "signin" || action === "callback";
}

type RouteHandler = (req: Request, ctx: unknown) => Promise<Response> | Response;

/**
 * Refuse a sign-in POST (magic link, local or invite-code credentials) whose
 * e-mail fails the account policy. The JSON carries `url` with
 * `?error=EmailNotAccepted` so next-auth's client `signIn()` reports the
 * error instead of reading the 400 as a success.
 */
export function withAccountEmailPolicy(handler: RouteHandler, errorPath = "/auth-error"): RouteHandler {
  return async (req, ctx) => {
    if (isSignInPost(req)) {
      const email = await emailFromAuthPost(req);
      if (email && isBlockedAccountEmail(email)) {
        const url = new URL(errorPath, req.url);
        url.searchParams.set("error", AUTH_ERROR_EMAIL_NOT_ACCEPTED);
        return Response.json(emailNotAcceptedBody(localeFromRequest(req), url.toString()), {
          status: 400,
        });
      }
    }
    return handler(req, ctx);
  };
}
