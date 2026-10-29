// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import PAGE_DATES from "./page-dates.json";

/**
 * The last change of the content behind a public page, from
 * `page-dates.json` (written from the git history by
 * `scripts/page-dates.mjs`, checked in CI). Pages without a recorded date
 * get none: never the build or request time.
 */
export function lastModifiedFor(
  path: string,
  dates: Record<string, string> = PAGE_DATES as Record<string, string>,
): Date | undefined {
  const value = dates[path];
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
