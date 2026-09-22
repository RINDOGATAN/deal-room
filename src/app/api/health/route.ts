// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Health check.
 *
 * GET /api/health — read by the hosting provider's checks, uptime monitors,
 * the suite's container healthcheck and the storefront's digest.
 *
 * Response shape:
 *   {
 *     ok: boolean,
 *     reason: null | "database" | "migrations",
 *     time: ISO timestamp,
 *     commit: short git sha of the build, or null,
 *     version: the build's version,
 *     services: {
 *       database: "ok" | "unreachable",
 *       migrations: "ok" | "mismatch" | "unknown",
 *       databaseLatencyMs?: number
 *     }
 *   }
 *
 * HTTP status:
 *   200 — the database answered a trivial query within 2 seconds AND its
 *         last applied migration is the build's last migration.
 *   503 — otherwise, with one reason word and no detail. The cause goes to
 *         the server log only.
 *
 * Public endpoint — no auth. Reads only `_prisma_migrations` (and the
 * rate-limit counter), never user data. The git sha is already public on
 * GitHub for the same commit.
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import {
  checkPublicRateLimit,
  clientIp,
  tooManyRequests,
} from "@/server/middleware/public-rate-limit";
import { checkHealth, type HealthProbe, type MigrationState } from "@/server/health";

const logger = createLogger("health");

// Recorded at build time by next.config.ts.
const EXPECTED_MIGRATION = process.env.DEALROOM_BUILD_MIGRATION ?? "";
const VERSION = process.env.DEALROOM_BUILD_VERSION || "unknown";
const COMMIT =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || process.env.DEALROOM_BUILD_COMMIT || null;

const probe: HealthProbe = {
  // One round-trip, touches no table.
  ping: () => prisma.$queryRaw`SELECT 1`,
  async migrations(): Promise<MigrationState> {
    const rows = await prisma.$queryRaw<{ last_applied: string | null; failed: bigint | number }[]>`
      SELECT
        (SELECT migration_name FROM _prisma_migrations
          WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
          ORDER BY migration_name DESC LIMIT 1) AS last_applied,
        (SELECT COUNT(*) FROM _prisma_migrations
          WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS failed`;
    return { lastApplied: rows[0]?.last_applied ?? null, failed: Number(rows[0]?.failed ?? 0) };
  },
};

export async function GET(request: Request) {
  // Per-IP limit. Fails open, so an unreachable database still reaches the
  // probe below and reports 503 rather than a limiter error.
  const limit = await checkPublicRateLimit("health", clientIp(request.headers));
  if (!limit.allowed) return tooManyRequests(limit);

  const verdict = await checkHealth(probe, EXPECTED_MIGRATION, undefined, (reason, err) => {
    logger.error("health check failed", { reason, err: String(err) });
  });

  return NextResponse.json(
    {
      ok: verdict.ok,
      reason: verdict.reason,
      time: new Date().toISOString(),
      commit: COMMIT,
      version: VERSION,
      services: {
        database: verdict.reason === "database" ? "unreachable" : "ok",
        migrations: verdict.ok ? "ok" : verdict.reason === "migrations" ? "mismatch" : "unknown",
        ...(verdict.databaseLatencyMs !== null && { databaseLatencyMs: verdict.databaseLatencyMs }),
      },
    },
    {
      status: verdict.ok ? 200 : 503,
      // Defeat any CDN caching — uptime monitors need a fresh read every time.
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
