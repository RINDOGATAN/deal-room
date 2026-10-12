// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/** Two e-mail addresses are the same account when they match after trimming, ignoring case. An empty address matches nothing. */
export function sameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a ?? "").trim().toLowerCase();
  const right = (b ?? "").trim().toLowerCase();
  return left.length > 0 && left === right;
}
