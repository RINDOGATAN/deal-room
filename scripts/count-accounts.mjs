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
 * Optional: CONTRACT_BILLING_START (the same ISO date the app reads) bounds
 * the payment part of `paying`. Without it every paid row counts, and
 * `source` says so.
 *
 * Prints ONE JSON object and nothing else. With --out=DIR it also writes
 * DIR/dealroom.json. Read-only by construction: every statement is a COUNT,
 * or one SELECT of aggregates (COUNT, SUM, MIN, MAX) over the billing tables.
 * No row is ever returned, so no name, address, domain, title or free text
 * can reach the output. A failure prints the error class only.
 *
 * Definitions:
 *   users          every account row (cycle 11 definition, kept unfiltered so
 *                  the series stays comparable between snapshots)
 *   organizations  null — Dealroom has no organization table (tenants are
 *                  Customers)
 *   paying         distinct customers with at least one paid contract or
 *                  unrefunded credit pack since CONTRACT_BILLING_START, plus
 *                  customers holding an active, unexpired, non-trial
 *                  entitlement; fixture customers excluded
 *   installs       null — nothing reports installs (self-host licences verify
 *                  offline)
 *   activity       integer figures of real use; `_total` = all time, `_30d` =
 *                  the last 30 days. Fixture records excluded (see below).
 *   activity_labels  the same keys, each with a plain English label
 *   revenue        pay per contract income in minor units (2900 = 29.00) by
 *                  currency, from contract payments still PAID (a fully
 *                  refunded payment is REVOKED and drops out), plus the first
 *                  and last payment times. Credit packs are counted but carry
 *                  no amount in the database, so they are not in revenue.
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

/** The same fixture addresses as LIKE patterns, for the billing statement. */
export const FIXTURE_EMAIL_PATTERNS = FIXTURE_EMAIL_FILTERS.flatMap((filter) =>
  filter.endsWith ? [`%${filter.endsWith}`] : filter.in,
);

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
  contracts_paid_total: "Contracts paid",
  contracts_paid_30d: "Contracts paid, 30 days",
  credit_packs_bought_total: "Credit packs bought",
  credit_packs_bought_30d: "Credit packs bought, 30 days",
  credits_spent_total: "Credits spent",
  credits_spent_30d: "Credits spent, 30 days",
  refunds_total: "Refunds",
};

/** Fields of the top-level `revenue` object, in output order. */
export const REVENUE_KEYS = [
  "usd_minor_total",
  "eur_minor_total",
  "usd_minor_30d",
  "eur_minor_30d",
  "first_paid_at",
  "last_paid_at",
];

function source(billingStart) {
  const since = billingStart
    ? `since CONTRACT_BILLING_START ${billingStart.toISOString().slice(0, 10)}`
    : "at any time (CONTRACT_BILLING_START not given)";
  return (
    "Dealroom PostgreSQL, read-only COUNT queries and one SELECT of COUNT/SUM/MIN/MAX aggregates; " +
    "users = every account row, unfiltered; " +
    "organizations null: Dealroom has no organization table (tenants are Customers); " +
    `paying = distinct customers with at least one paid contract or unrefunded credit pack ${since}, ` +
    "plus customers with an active, unexpired, non-trial entitlement; " +
    "installs null: nothing reports installs; " +
    "activity: agreed = status agreed, signing or completed, signed = fully signed, " +
    "active users = signed in or left an audit entry in 30 days; " +
    "contracts paid = deal_payments kind CONTRACT still PAID; " +
    "credit packs bought = customer_credit_entries PURCHASE without a REVERSAL for the same checkout; " +
    "credits spent = customer_credit_entries CONSUME; " +
    "refunds = contract payments REVOKED for reason refunded plus credit pack REVERSAL entries; " +
    "revenue = SUM of deal_payments.amount (minor units) of contracts still PAID, by currency, " +
    "so a full refund drops out; partial refunds are not recorded in the database and are neither " +
    "counted nor subtracted; credit pack amounts are not recorded in the database and are not in revenue; " +
    "excluded from paying, activity and revenue: simulator deals (name prefix), simulator accounts, " +
    "the three tester accounts, seed and end-to-end accounts on reserved test domains; " +
    "could not be excluded: the owner's own test accounts on ordinary addresses, " +
    "which the schema cannot tell apart."
  );
}

/** Anything but a non-negative integer becomes null, so no row value can pass. */
function asCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/** A whole number of minor units, or null. Raw SUMs arrive as BigInt. */
function asAmount(value) {
  if (typeof value === "bigint") {
    return value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
  }
  return asCount(value);
}

/** A timestamp as ISO text, or null: only a real Date passes. */
function asInstant(value) {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null;
}

/** The billing start date (ISO), or null when missing or not a date. */
export function billingStartFrom(raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return null;
  const at = new Date(text);
  return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * The billing figures and `paying`, in one read-only statement. The billing
 * tables hold customer ids without a Prisma relation, so the fixture
 * exclusions are written in SQL; the CTEs mirror REAL_DEAL and
 * FIXTURE_EMAIL_FILTERS above. Every value is a bound parameter, and the
 * outer SELECT returns one row of aggregates and nothing else. Prisma keeps
 * DateTime columns as UTC `timestamp`, so dates are bound as `::timestamp`.
 */
function billingFigures(db, { now, since, billingStart }) {
  const fixtures = FIXTURE_EMAIL_PATTERNS;
  const demoDeals = `${DEMO_DEAL_PREFIX}%`;
  const start = billingStart ? billingStart.toISOString() : null;
  const sinceAt = since.toISOString();
  const nowAt = now.toISOString();
  return db.$queryRaw`
    WITH fixture_customers AS (
      SELECT id FROM customers WHERE email LIKE ANY(${fixtures}::text[])
    ), fixture_users AS (
      SELECT id FROM users WHERE email LIKE ANY(${fixtures}::text[])
    ), real_deals AS (
      SELECT d.id FROM deal_rooms d
      WHERE d.name NOT LIKE ${demoDeals}
        AND NOT EXISTS (
          SELECT 1 FROM deal_room_parties p
          WHERE p."dealRoomId" = d.id AND p.email LIKE ANY(${fixtures}::text[])
        )
    ), contract_payments AS (
      SELECT dp."customerId", dp.status::text AS status, dp."revokedReason", dp.amount,
             lower(dp.currency) AS currency, dp."paidAt"
      FROM deal_payments dp
      WHERE dp.kind::text = 'CONTRACT'
        AND dp."dealRoomId" IN (SELECT id FROM real_deals)
        AND (dp."customerId" IS NULL OR dp."customerId" NOT IN (SELECT id FROM fixture_customers))
        AND (dp."payerUserId" IS NULL OR dp."payerUserId" NOT IN (SELECT id FROM fixture_users))
    ), paid_contracts AS (
      SELECT "customerId", amount, currency, "paidAt" FROM contract_payments WHERE status = 'PAID'
    ), entries AS (
      SELECT e."customerId", e.reason::text AS reason, e.delta, e."stripeCheckoutSessionId", e."createdAt"
      FROM customer_credit_entries e
      WHERE e."customerId" NOT IN (SELECT id FROM fixture_customers)
        AND (e."dealRoomId" IS NULL OR e."dealRoomId" IN (SELECT id FROM real_deals))
    ), packs AS (
      SELECT p."customerId", p."createdAt" FROM entries p
      WHERE p.reason = 'PURCHASE'
        AND NOT EXISTS (
          SELECT 1 FROM customer_credit_entries r
          WHERE r.reason::text = 'REVERSAL' AND r."stripeCheckoutSessionId" = p."stripeCheckoutSessionId"
        )
    )
    SELECT
      (SELECT COUNT(*) FROM paid_contracts)::int AS contracts_paid_total,
      (SELECT COUNT(*) FROM paid_contracts WHERE "paidAt" >= ${sinceAt}::timestamp)::int AS contracts_paid_30d,
      (SELECT COUNT(*) FROM packs)::int AS credit_packs_bought_total,
      (SELECT COUNT(*) FROM packs WHERE "createdAt" >= ${sinceAt}::timestamp)::int AS credit_packs_bought_30d,
      (SELECT COALESCE(SUM(-delta), 0) FROM entries WHERE reason = 'CONSUME')::int AS credits_spent_total,
      (SELECT COALESCE(SUM(-delta), 0) FROM entries
         WHERE reason = 'CONSUME' AND "createdAt" >= ${sinceAt}::timestamp)::int AS credits_spent_30d,
      ((SELECT COUNT(*) FROM contract_payments WHERE status = 'REVOKED' AND "revokedReason" = 'refunded')
        + (SELECT COUNT(*) FROM entries WHERE reason = 'REVERSAL'))::int AS refunds_total,
      (SELECT COALESCE(SUM(amount), 0) FROM paid_contracts WHERE currency = 'usd')::bigint AS usd_minor_total,
      (SELECT COALESCE(SUM(amount), 0) FROM paid_contracts WHERE currency = 'eur')::bigint AS eur_minor_total,
      (SELECT COALESCE(SUM(amount), 0) FROM paid_contracts
         WHERE currency = 'usd' AND "paidAt" >= ${sinceAt}::timestamp)::bigint AS usd_minor_30d,
      (SELECT COALESCE(SUM(amount), 0) FROM paid_contracts
         WHERE currency = 'eur' AND "paidAt" >= ${sinceAt}::timestamp)::bigint AS eur_minor_30d,
      LEAST((SELECT MIN("paidAt") FROM paid_contracts), (SELECT MIN("createdAt") FROM packs)) AS first_paid_at,
      GREATEST((SELECT MAX("paidAt") FROM paid_contracts), (SELECT MAX("createdAt") FROM packs)) AS last_paid_at,
      (SELECT COUNT(*) FROM customers c
        WHERE c.id NOT IN (SELECT id FROM fixture_customers)
          AND (
            EXISTS (
              SELECT 1 FROM skill_entitlements s
              WHERE s."customerId" = c.id AND s.status::text = 'ACTIVE' AND s."licenseType"::text <> 'TRIAL'
                AND (s."expiresAt" IS NULL OR s."expiresAt" > ${nowAt}::timestamp)
            )
            OR EXISTS (
              SELECT 1 FROM paid_contracts pc
              WHERE pc."customerId" = c.id
                AND (${start}::timestamp IS NULL OR pc."paidAt" >= ${start}::timestamp)
            )
            OR EXISTS (
              SELECT 1 FROM packs pk
              WHERE pk."customerId" = c.id
                AND (${start}::timestamp IS NULL OR pk."createdAt" >= ${start}::timestamp)
            )
          ))::int AS paying
  `;
}

/**
 * Builds the count object. `db` is a Prisma client (or a mock of one); only
 * its `count` methods and one `$queryRaw` of aggregates are called.
 *
 * @param {any} db
 * @param {Date} [now]
 * @param {{ billingStart?: Date | null }} [options]
 */
export async function buildCounts(db, now = new Date(), { billingStart = null } = {}) {
  const since = new Date(now.getTime() - 30 * DAY_MS);

  const queries = {
    users: db.user.count(),
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
  const [values, billingRows] = await Promise.all([
    Promise.all(keys.map((key) => queries[key])),
    billingFigures(db, { now, since, billingStart }),
  ]);
  const billing =
    Array.isArray(billingRows) && billingRows.length === 1 && billingRows[0] && typeof billingRows[0] === "object"
      ? billingRows[0]
      : {};
  const counted = Object.fromEntries(
    keys.map((key, i) => [key, asCount(values[i])]),
  );
  for (const key of Object.keys(ACTIVITY_LABELS)) {
    if (!(key in counted)) counted[key] = asCount(billing[key]);
  }

  const activity = Object.fromEntries(
    Object.keys(ACTIVITY_LABELS).map((key) => [key, counted[key]]),
  );

  const revenue = Object.fromEntries(
    REVENUE_KEYS.map((key) => [
      key,
      key.endsWith("_at") ? asInstant(billing[key]) : asAmount(billing[key]),
    ]),
  );

  return {
    product: PRODUCT,
    users: counted.users,
    organizations: null,
    paying: asCount(billing.paying),
    installs: null,
    activity,
    activity_labels: { ...ACTIVITY_LABELS },
    revenue,
    as_of: now.toISOString(),
    source: source(billingStart),
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
    const billingStart = billingStartFrom(process.env.CONTRACT_BILLING_START);
    const counts = await buildCounts(db, new Date(), { billingStart });
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
