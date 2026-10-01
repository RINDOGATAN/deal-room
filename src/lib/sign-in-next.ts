// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Where sign-in returns to: the `next` query parameter when it is a path
 * on this site (`/deals/new?q=NDA`), otherwise `/deals`. Anything that
 * could leave the site (`//host`, `/\host`, `https://…`) is ignored.
 */
export const DEFAULT_AFTER_SIGN_IN = "/deals";

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_AFTER_SIGN_IN;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return DEFAULT_AFTER_SIGN_IN;
  if (/[\u0000-\u001f]/.test(raw)) return DEFAULT_AFTER_SIGN_IN;
  return raw;
}

/** The sign-in page's return path, read from the current address (browser only). */
export function nextPathFromLocation(): string {
  if (typeof window === "undefined") return DEFAULT_AFTER_SIGN_IN;
  return safeNextPath(new URLSearchParams(window.location.search).get("next"));
}

/** A sign-in link that returns to `path` afterwards. */
export function signInHref(path: string): string {
  return `/sign-in?next=${encodeURIComponent(path)}`;
}
