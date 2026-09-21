#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC
/**
 * count-accounts.mjs — read-only account and activity counts for Dealroom.
 *
 * Usage:
 *   DATABASE_URL="<connection string>" node scripts/count-accounts.mjs [--out=DIR]
 *
 * Reads a production database: do not run without the owner's go-ahead.
 *
 * Prints ONE JSON object and nothing else. With --out=DIR it also writes
 * DIR/dealroom.json. Read-only by construction: every statement is a COUNT.
 * No row is ever selected, so no name, address, domain, title or free text
 * can reach the output. A failure prints the error class only.
 *
 * Definitions:
 *   users          every account row (cycle 11 definition, kept unfiltered so
 *                  the series stays comparable between snapshots)
 *   organizations  null — Dealroom has no organization table (tenants are
 *                  Customers)
 *   paying         distinct customers holding an active, unexpired, non-trial
 *                  entitlement; fixture customers excluded
 *   installs       null — nothing reports installs (self-host licences verify
 *                  offline)
 *   activity       integer figures of real use; `_total` = all time, `_30d` =
 *                  the last 30 days. Fixture records excluded (see below).
 *   activity_labels  the same keys, each with a plain English label
 *
 * null = not applicable, 0 = a measured zero.
 *
 * Fixtures the schema can tell apart, and which the activity figures and
 * `paying` exclude: the deal simulator's deals (name prefix) and accounts,
 * the three tester quick-access accounts, and seed / end-to-end accounts on
 * the reserved `.test` and `example.com` domains. The owner's own test
 * accounts on ordinary addresses cannot be told apart and are counted.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PRODUCT = "DEALROOM";
export const CONNECTION_VARIABLE = "DATABASE_URL";

const DAY_MS = 24 * 60 * 60 * 1000;

// scripts/simulate-deals.ts names every deal it creates with this prefix.
const DEMO_DEAL_PREFIX = "Demo:";

// Addresses that only fixtures use. Applied as WHERE filters, never read back.
const FIXTURE_EMAIL_FILTERS = [
  { endsWith: "@demo.todo.law" }, // deal simulator accounts
  { endsWith: ".test" }, // seed fixtures and end-to-end accounts (reserved TLD)
  { endsWith: "@example.com" },
  {
    // tester quick-access accounts (src/lib/tester.ts)
    in: [
      "tester-startup@todo.law",
      "tester-lawyer@todo.law",
      "tester-business@todo.law",
    ],
  },
];

/** A `NOT` clause excluding fixture addresses held in `field`. */
function notFixture(field) {
  return FIXTURE_EMAIL_FILTERS.map((filter) => ({ [field]: filter }));
}

/** Deals that are neither simulator output nor joined by a fixture account. */
const REAL_DEAL = {
  NOT: [{ name: { startsWith: DEMO_DEAL_PREFIX } }],
  parties: {
    none: { OR: FIXTURE_EMAIL_FILTERS.map((filter) => ({ email: filter })) },
  },
};

const REAL_AGENT_DEAL = { NOT: notFixture("initiatorEmail") };

export const ACTIVITY_LABELS = {
  deals_created_total: "Deals created",
  deals_created_30d: "Deals created, 30 days",
  deals_agreed_total: "Deals agreed",
  deals_signed_total: "Deals signed",
  deals_signed_30d: "Deals signed, 30 days",
  agent_negotiations_agreed_total: "Agent negotiations agreed",
  agent_negotiations_agreed_30d: "Agent negotiations agreed, 30 days",
  disputes_filed_total: "Disputes filed",
  disputes_filed_30d: "Disputes filed, 30 days",
  active_users_30d: "Active users, 30 days",
};

const SOURCE =
  "Dealroom PostgreSQL, read-only COUNT queries only; users = every account row, unfiltered; " +
  "organizations null: Dealroom has no organization table (tenants are Customers); " +
  "paying = distinct customers with an active, unexpired, non-trial entitlement; " +
  "installs null: nothing reports installs; " +
  "activity: agreed = status agreed, signing or completed, signed = fully signed, " +
  "active users = signed in or left an audit entry in 30 days; " +
  "excluded from paying and activity: simulator deals (name prefix), simulator accounts, " +
  "the three tester accounts, seed and end-to-end accounts on reserved test domains; " +
  "could not be excluded: the owner's own test accounts on ordinary addresses, " +
  "which the schema cannot tell apart.";

/** Anything but a non-negative integer becomes null, so no row value can pass. */
function asCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * Builds the count object. `db` is a Prisma client (or a mock of one); only
 * its `count` methods are called.
 */
export async function buildCounts(db, now = new Date()) {
  const since = new Date(now.getTime() - 30 * DAY_MS);

  const queries = {
    users: db.user.count(),
    paying: db.customer.count({
      where: {
        NOT: notFixture("email"),
        entitlements: {
          some: {
            status: "ACTIVE",
            licenseType: { not: "TRIAL" },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        },
      },
    }),
    deals_created_total: db.dealRoom.count({ where: REAL_DEAL }),
    deals_created_30d: db.dealRoom.count({
      where: { ...REAL_DEAL, createdAt: { gte: since } },
    }),
    deals_agreed_total: db.dealRoom.count({
      where: { ...REAL_DEAL, status: { in: ["AGREED", "SIGNING", "COMPLETED"] } },
    }),
    deals_signed_total: db.dealRoom.count({
      where: { ...REAL_DEAL, status: "COMPLETED" },
    }),
    deals_signed_30d: db.dealRoom.count({
      where: {
        ...REAL_DEAL,
        status: "COMPLETED",
        signingRequest: { completedAt: { gte: since } },
      },
    }),
    agent_negotiations_agreed_total: db.agentDealRoom.count({
      where: { ...REAL_AGENT_DEAL, status: "AGREED" },
    }),
    agent_negotiations_agreed_30d: db.agentDealRoom.count({
      where: { ...REAL_AGENT_DEAL, status: "AGREED", resolvedAt: { gte: since } },
    }),
    disputes_filed_total: db.agentDispute.count({
      where: { agentDealRoom: REAL_AGENT_DEAL },
    }),
    disputes_filed_30d: db.agentDispute.count({
      where: { agentDealRoom: REAL_AGENT_DEAL, createdAt: { gte: since } },
    }),
    active_users_30d: db.user.count({
      where: {
        NOT: notFixture("email"),
        OR: [
          { lastLoginAt: { gte: since } },
          { auditLogs: { some: { createdAt: { gte: since } } } },
        ],
      },
    }),
  };

  const keys = Object.keys(queries);
  const values = await Promise.all(keys.map((key) => queries[key]));
  const counted = Object.fromEntries(
    keys.map((key, i) => [key, asCount(values[i])]),
  );

  const activity = Object.fromEntries(
    Object.keys(ACTIVITY_LABELS).map((key) => [key, counted[key]]),
  );

  return {
    product: PRODUCT,
    users: counted.users,
    organizations: null,
    paying: counted.paying,
    installs: null,
    activity,
    activity_labels: { ...ACTIVITY_LABELS },
    as_of: now.toISOString(),
    source: SOURCE,
  };
}

/** The class of an error and nothing else: messages can carry a host or a value. */
export function errorClass(error) {
  const name =
    error && typeof error === "object" && error.constructor
      ? error.constructor.name
      : "";
  return /^[A-Za-z]{1,60}$/.test(name) ? name : "Error";
}

async function main() {
  const outArg = process.argv.slice(2).find((arg) => arg.startsWith("--out="));
  const url = process.env[CONNECTION_VARIABLE];
  // Checked before Prisma is loaded: Prisma reads .env on import, and a local
  // file must never stand in for a connection string the caller did not give.
  if (!url) {
    console.error(`count-accounts: ${CONNECTION_VARIABLE} is not set`);
    process.exit(2);
  }

  let db;
  try {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url } }, log: [] });
    const counts = await buildCounts(db);
    const json = JSON.stringify(counts, null, 2);
    if (outArg) {
      const dir = outArg.slice("--out=".length);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, `${PRODUCT.toLowerCase()}.json`), `${json}\n`);
    }
    console.log(json);
  } catch (error) {
    console.error(`count-accounts: failed (${errorClass(error)})`);
    process.exitCode = 1;
  } finally {
    if (db) await db.$disconnect().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
