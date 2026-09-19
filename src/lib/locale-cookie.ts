// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The single `locale` cookie shared across todo.law (same contract in every
 * suite app and the storefront):
 *   - name `locale`, value `en` | `es`, Path=/, one year, SameSite=Lax;
 *   - on a hosted host (*.todo.law) always Domain=.todo.law, else host-only;
 *   - only written when the visitor chooses a language (no defaults);
 *   - readers take the LAST `locale` value in the Cookie header;
 *   - duplicates (host-only next to domain-wide) are expired and rewritten.
 *
 * `NEXT_LOCALE` is the retired dashboard cookie: still honoured when `locale`
 * is absent so earlier choices survive, then migrated and expired.
 */

import { locales, type Locale } from "@/i18n/config";

export const LOCALE_COOKIE = "locale";
export const LEGACY_LOCALE_COOKIE = "NEXT_LOCALE";
export const HOSTED_COOKIE_DOMAIN = ".todo.law";
const ONE_YEAR = 365 * 24 * 60 * 60;

export function isLocale(v: string | undefined | null): v is Locale {
  return locales.includes(v as Locale);
}

export function isHostedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "todo.law" || h.endsWith(".todo.law");
}

/** Every value of `name` in a Cookie header (or `document.cookie`), in order. */
export function cookieValues(cookieHeader: string | null | undefined, name: string): string[] {
  if (!cookieHeader) return [];
  const values: string[] = [];
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      values.push(decodeURIComponent(raw));
    } catch {
      values.push(raw);
    }
  }
  return values;
}

/** The last `locale` value in the header, when it is a supported locale. */
export function readLocaleFromCookieHeader(cookieHeader: string | null | undefined): Locale | undefined {
  const last = cookieValues(cookieHeader, LOCALE_COOKIE).at(-1);
  return isLocale(last) ? last : undefined;
}

/** `locale` first, then the legacy dashboard cookie (last value of each). */
export function resolveChosenLocale(cookieHeader: string | null | undefined): Locale | undefined {
  const chosen = readLocaleFromCookieHeader(cookieHeader);
  if (chosen) return chosen;
  const legacy = cookieValues(cookieHeader, LEGACY_LOCALE_COOKIE).at(-1);
  return isLocale(legacy) ? legacy : undefined;
}

function expireCookie(name: string, domain?: string): string {
  return `${name}=; Path=/; Max-Age=0; SameSite=Lax${domain ? `; Domain=${domain}` : ""}`;
}

function localeCookie(locale: Locale, hostname: string): string {
  const domain = isHostedHost(hostname) ? `; Domain=${HOSTED_COOKIE_DOMAIN}` : "";
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax${domain}`;
}

/**
 * The cookie strings that record a chosen locale, in the order they must be
 * applied: on a hosted host the host-only duplicate is expired first, then
 * the domain-wide cookie is written. The legacy cookie is expired alongside
 * when `legacyPresent` (both variants on a hosted host).
 */
export function localeCookieWrites(locale: Locale, hostname: string, legacyPresent = false): string[] {
  const writes: string[] = [];
  const hosted = isHostedHost(hostname);
  if (hosted) writes.push(expireCookie(LOCALE_COOKIE));
  writes.push(localeCookie(locale, hostname));
  if (legacyPresent) {
    writes.push(expireCookie(LEGACY_LOCALE_COOKIE));
    if (hosted) writes.push(expireCookie(LEGACY_LOCALE_COOKIE, HOSTED_COOKIE_DOMAIN));
  }
  return writes;
}

/**
 * Server clean-up for an incoming Cookie header: the Set-Cookie values to
 * emit, or none when the header already carries at most one `locale` and no
 * legacy cookie. Never writes a default.
 */
export function localeCleanupSetCookies(cookieHeader: string | null | undefined, hostname: string): string[] {
  const count = cookieValues(cookieHeader, LOCALE_COOKIE).length;
  const legacyPresent = cookieValues(cookieHeader, LEGACY_LOCALE_COOKIE).length > 0;
  if (count <= 1 && !legacyPresent) return [];
  const chosen = resolveChosenLocale(cookieHeader);
  if (!chosen) {
    // Nothing valid to keep: only drop the duplicates / legacy cookie.
    const writes: string[] = [];
    if (count > 1) writes.push(expireCookie(LOCALE_COOKIE));
    if (legacyPresent) {
      writes.push(expireCookie(LEGACY_LOCALE_COOKIE));
      if (isHostedHost(hostname)) writes.push(expireCookie(LEGACY_LOCALE_COOKIE, HOSTED_COOKIE_DOMAIN));
    }
    return writes;
  }
  return localeCookieWrites(chosen, hostname, legacyPresent);
}

// ── Client side ─────────────────────────────────────────────────────────

/** Client reader: the last `locale` value (legacy cookie as fallback). */
export function readLocaleCookie(): Locale | undefined {
  if (typeof document === "undefined") return undefined;
  return resolveChosenLocale(document.cookie);
}

/** Client writer: the only code that writes the `locale` cookie in the browser. */
export function writeLocaleCookie(locale: Locale): void {
  if (typeof document === "undefined") return;
  const legacyPresent = cookieValues(document.cookie, LEGACY_LOCALE_COOKIE).length > 0;
  for (const c of localeCookieWrites(locale, window.location.hostname, legacyPresent)) {
    document.cookie = c;
  }
}

/** Client clean-up on page load: collapse duplicates into one cookie. */
export function cleanUpLocaleCookie(): void {
  if (typeof document === "undefined") return;
  for (const c of localeCleanupSetCookies(document.cookie, window.location.hostname)) {
    document.cookie = c;
  }
}
