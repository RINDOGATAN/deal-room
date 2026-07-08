// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Health check.
 *
 * GET /api/health — returns a small JSON snapshot suitable for an
 * uptime monitor (UptimeRobot, BetterStack, etc.) or a quick
 * "is the site OK right now" smoke test.
 *
 * Response shape:
 *   {
 *     ok: boolean,
 *     time: ISO timestamp,
 *     commit: short git sha (from VERCEL_GIT_COMMIT_SHA),
 *     version: package.json version,
 *     services: { database: "ok" | "unreachable", databaseLatencyMs?: number }
 *   }
 *
 * HTTP status:
 *   200 — everything healthy.
 *   503 — at least one downstream is unreachable. Body still
 *         describes which service is broken so the monitor can
 *         alert with useful context, not just "site down".
 *
 * Public endpoint — no auth. Body contains only operational
 * metadata (no secrets, no PII, no tenant data). The git sha is
 * already public on GitHub for the same commit.
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const logger = createLogger("health");

const VERSION = "0.1.0"; // mirrors package.json; bumped manually on releases

interface HealthSnapshot {
  ok: boolean;
  time: string;
  commit: string | null;
  version: string;
  services: {
    database: "ok" | "unreachable";
    databaseLatencyMs?: number;
  };
}

export async function GET() {
  const start = Date.now();
  const snapshot: HealthSnapshot = {
    ok: true,
    time: new Date().toISOString(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    version: VERSION,
    services: { database: "ok" },
  };

  // Cheapest possible round-trip to confirm Postgres is reachable.
  // SELECT 1 is one packet round-trip and does not touch any table.
  try {
    await prisma.$queryRaw`SELECT 1`;
    snapshot.services.databaseLatencyMs = Date.now() - start;
  } catch (e) {
    // Detail goes to the Vercel log so we can see the cause; the
    // public response stays minimal — a status flip plus the
    // `database: "unreachable"` service marker is enough for an
    // uptime monitor to alert on without leaking internals.
    logger.error("database probe failed", { err: String(e) });
    snapshot.ok = false;
    snapshot.services.database = "unreachable";
  }

  return NextResponse.json(snapshot, {
    status: snapshot.ok ? 200 : 503,
    // Defeat any CDN caching — uptime monitors need a fresh read every time.
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
