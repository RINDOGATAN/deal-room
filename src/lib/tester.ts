/**
 * Tester mode — production-safe quick-login + data-reset for fictitious users.
 *
 * Activated when `TESTER_MODE_ENABLED=true` (server) and
 * `NEXT_PUBLIC_TESTER_MODE=true` (client). Only the three emails in
 * `TESTER_EMAILS` can sign in via this path; the rest of the user table
 * is unaffected. There is no password — the env var being set on the
 * server, combined with the email allowlist, is the gate.
 *
 * Intended for UX testing across the three personas (startup founder,
 * lawyer, business owner) without burning real magic links.
 */

export const TESTER_EMAILS = [
  "tester-startup@todo.law",
  "tester-lawyer@todo.law",
  "tester-business@todo.law",
] as const;

export type TesterEmail = (typeof TESTER_EMAILS)[number];

export function isTesterEmail(email: string | null | undefined): email is TesterEmail {
  if (!email) return false;
  return (TESTER_EMAILS as readonly string[]).includes(email.toLowerCase());
}

/**
 * Tester mode is on when the server-side env var is set. Used by API
 * routes and the auth provider; never the client.
 */
export function isTesterModeServer(): boolean {
  return process.env.TESTER_MODE_ENABLED === "true";
}
