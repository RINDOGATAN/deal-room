// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The health verdict behind `/api/health`.
 *
 * Healthy means both:
 *   - the database answers a trivial query within 2 seconds; and
 *   - the last migration recorded in the database is the last migration the
 *     build ships (recorded at build time by next.config.ts, because the
 *     runtime image carries no prisma/migrations folder), with none failed.
 *
 * Otherwise the verdict names one reason word, `database` or `migrations`,
 * and nothing more. Reads only `_prisma_migrations`, never user data.
 */

export const HEALTH_DB_TIMEOUT_MS = 2_000;

export type HealthReason = "database" | "migrations";

export interface MigrationState {
  /** Name of the last successfully applied migration, or null if none. */
  lastApplied: string | null;
  /** Migrations started but neither finished nor rolled back. */
  failed: number;
}

export interface HealthProbe {
  ping(): Promise<unknown>;
  migrations(): Promise<MigrationState>;
}

export interface HealthVerdict {
  ok: boolean;
  reason: HealthReason | null;
  databaseLatencyMs: number | null;
}

class Timeout extends Error {}

function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Timeout()), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export async function checkHealth(
  probe: HealthProbe,
  expectedMigration: string,
  timeoutMs: number = HEALTH_DB_TIMEOUT_MS,
  onFailure: (reason: HealthReason, err: unknown) => void = () => {},
): Promise<HealthVerdict> {
  const start = Date.now();
  try {
    await within(probe.ping(), timeoutMs);
  } catch (err) {
    onFailure("database", err);
    return { ok: false, reason: "database", databaseLatencyMs: null };
  }
  const databaseLatencyMs = Date.now() - start;

  let state: MigrationState;
  try {
    state = await within(probe.migrations(), timeoutMs);
  } catch (err) {
    // No migrations table (never migrated) or the read failed: migrations
    // cannot be confirmed, so the build is not known to match.
    onFailure("migrations", err);
    return { ok: false, reason: "migrations", databaseLatencyMs };
  }

  if (!expectedMigration || state.failed > 0 || state.lastApplied !== expectedMigration) {
    onFailure(
      "migrations",
      new Error(
        `expected ${expectedMigration || "<none recorded>"}, applied ${state.lastApplied ?? "<none>"}, failed ${state.failed}`,
      ),
    );
    return { ok: false, reason: "migrations", databaseLatencyMs };
  }

  return { ok: true, reason: null, databaseLatencyMs };
}
