// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Sign-up e-mail policy (shared helper; identical logic in every repository).
 *
 * Refuses two kinds of address at sign-up, sign-in, invitations and public
 * forms. Existing stored data is never touched by this helper.
 *
 * 1. Dotted Gmail: domain gmail.com or googlemail.com, and the local part
 *    (before any "+") contains 3 or more dots.
 * 2. Blocked domains: hotmail.<tld>, hotmail.<sld>.<cc> (e.g. hotmail.co.uk),
 *    aol.<tld>, aol.<sld>.<cc>, matched on the registrable domain so that
 *    subdomains (mx.hotmail.com) are refused too.
 *
 * SCOPE: rule 1 applies everywhere (accounts and enquiry forms); rule 2 applies
 * only to accounts (sign-up, sign-in incl. Google, teammate invitations).
 * The DPO Central public rights-request form is excluded from both.
 *
 * One message for both rules, so the reason is not disclosed.
 */

export const BLOCKED_EMAIL_MESSAGE_KEY = "email_not_accepted";

export const BLOCKED_EMAIL_MESSAGES = {
  en: "Please use your work e-mail address, or a different personal address. We can't accept this one.",
  es: "Usa tu correo del trabajo u otra dirección personal. No podemos aceptar esta.",
} as const;

export function blockedEmailMessage(locale?: string | null): string {
  return locale && locale.toLowerCase().startsWith("es")
    ? BLOCKED_EMAIL_MESSAGES.es
    : BLOCKED_EMAIL_MESSAGES.en;
}

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);
const BLOCKED_BRANDS = new Set(["hotmail", "aol"]);
// Second-level labels used under country codes (hotmail.co.uk, hotmail.com.ar).
const SECOND_LEVEL = new Set(["co", "com", "net", "org", "ne", "or", "ac"]);

function isPublicSuffixTail(tail: string[]): boolean {
  if (tail.length === 1) return /^[a-z]{2,24}$/.test(tail[0]);
  if (tail.length === 2) return SECOND_LEVEL.has(tail[0]) && /^[a-z]{2}$/.test(tail[1]);
  return false;
}

function isBlockedDomain(domain: string): boolean {
  const labels = domain.split(".").filter(Boolean);
  // The brand must be the registrable label: brand.<tld> or brand.<sld>.<cc>,
  // optionally preceded by any subdomains.
  for (let i = 0; i < labels.length; i++) {
    if (BLOCKED_BRANDS.has(labels[i]) && isPublicSuffixTail(labels.slice(i + 1))) {
      return true;
    }
  }
  return false;
}

function parse(input: unknown): { local: string; domain: string } | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  return { local: email.slice(0, at), domain: email.slice(at + 1).replace(/\.+$/, "") };
}

/** Rule 1 only: dotted Gmail. Never throws. */
export function isDottedGmail(input: unknown): boolean {
  const p = parse(input);
  if (!p) return false;
  const isGmail = GMAIL_DOMAINS.has(p.domain) ||
    [...GMAIL_DOMAINS].some((d) => p.domain.endsWith("." + d));
  if (!isGmail) return false;
  const base = p.local.split("+")[0];
  return (base.match(/\./g) || []).length >= 3;
}

/**
 * Scope "account": sign-up, sign-in (incl. Google) and teammate invitations.
 * Both rules apply.
 */
export function isBlockedAccountEmail(input: unknown): boolean {
  const p = parse(input);
  if (!p) return false;
  return isDottedGmail(input) || isBlockedDomain(p.domain);
}

/**
 * Scope "enquiry": contact, booking, lead, enquiry and updates forms.
 * Rule 1 only, so hotmail and aol prospects can still reach us.
 */
export function isBlockedEnquiryEmail(input: unknown): boolean {
  return isDottedGmail(input);
}
