#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC
/**
 * count-review-interest.mjs — read-only counts of the lawyer-review interest
 * line on finished DPAs (table review_interest_events).
 *
 * Usage:
 *   DATABASE_URL="<connection string>" node scripts/count-review-interest.mjs [--since=YYYY-MM-DD]
 *
 * Reads a production database: run only with the operator's approval.
 *
 * Prints ONE JSON object: counts by event, then the submitted answers by
 * jurisdiction, by speed and by both. Read-only by construction: a single
 * GROUP BY of counts. The table holds no personal data, and no row is
 * returned. A failure prints the error class only.
 */

import { pathToFileURL } from "node:url";

export const CONNECTION_VARIABLE = "DATABASE_URL";
export const EVENTS = ["shown", "clicked", "answered", "california_link"];
export const JURISDICTIONS = ["california", "us_other", "eu", "uk", "elsewhere"];
export const SPEEDS = ["two_hours", "same_day", "this_week"];

const zeros = (keys) => Object.fromEntries(keys.map((k) => [k, 0]));

/**
 * Turn `groupBy(["event", "jurisdiction", "speed", "locale"])` rows into
 * the report. Unknown values are kept under their own key so nothing is
 * silently dropped.
 */
export function tally(rows) {
  const byEvent = zeros(EVENTS);
  const byLocale = /** @type {Record<string, Record<string, number>>} */ ({});
  const byJurisdiction = zeros(JURISDICTIONS);
  const bySpeed = zeros(SPEEDS);
  const byJurisdictionAndSpeed = Object.fromEntries(JURISDICTIONS.map((j) => [j, zeros(SPEEDS)]));

  for (const row of rows) {
    const n = Number(row?._count?._all ?? 0);
    if (!Number.isFinite(n) || n <= 0) continue;
    byEvent[row.event] = (byEvent[row.event] ?? 0) + n;
    byLocale[row.locale] ??= zeros(EVENTS);
    byLocale[row.locale][row.event] = (byLocale[row.locale][row.event] ?? 0) + n;
    if (row.event !== "answered") continue;
    const j = row.jurisdiction ?? "none";
    const s = row.speed ?? "none";
    byJurisdiction[j] = (byJurisdiction[j] ?? 0) + n;
    bySpeed[s] = (bySpeed[s] ?? 0) + n;
    byJurisdictionAndSpeed[j] ??= zeros(SPEEDS);
    byJurisdictionAndSpeed[j][s] = (byJurisdictionAndSpeed[j][s] ?? 0) + n;
  }

  return {
    by_event: byEvent,
    by_locale: byLocale,
    answered_by_jurisdiction: byJurisdiction,
    answered_by_speed: bySpeed,
    answered_by_jurisdiction_and_speed: byJurisdictionAndSpeed,
  };
}

export async function countReviewInterest(db, { since } = {}) {
  const rows = await db.reviewInterestEvent.groupBy({
    by: ["event", "jurisdiction", "speed", "locale"],
    where: since ? { createdAt: { gte: since } } : undefined,
    _count: { _all: true },
  });
  return { ...tally(rows), since: since ? since.toISOString() : null, as_of: new Date().toISOString() };
}

function errorClass(error) {
  const name = error && typeof error === "object" && error.constructor ? error.constructor.name : "";
  return /^[A-Za-z]{1,60}$/.test(name) ? name : "Error";
}

async function main() {
  const sinceArg = process.argv.slice(2).find((a) => a.startsWith("--since="));
  const since = sinceArg ? new Date(`${sinceArg.slice("--since=".length)}T00:00:00Z`) : undefined;
  if (since && Number.isNaN(since.getTime())) {
    console.error("count-review-interest: --since must be YYYY-MM-DD");
    process.exit(2);
  }
  const url = process.env[CONNECTION_VARIABLE];
  // Checked before Prisma is loaded: Prisma reads .env on import, and a local
  // file must never stand in for a connection string the caller did not give.
  if (!url) {
    console.error(`count-review-interest: ${CONNECTION_VARIABLE} is not set`);
    process.exit(2);
  }
  let db;
  try {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url } }, log: [] });
    console.log(JSON.stringify(await countReviewInterest(db, { since }), null, 2));
  } catch (error) {
    console.error(`count-review-interest: failed (${errorClass(error)})`);
    process.exitCode = 1;
  } finally {
    await db?.$disconnect().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
