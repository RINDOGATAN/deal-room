// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { PrismaClient } from "@prisma/client";

// Neon's compute can take longer to wake when the control plane is busy.
// 7 retries with a 3000 ms cap give us up to ~13 s of backoff (well under
// Vercel's 60 s function ceiling on Pro). Most cold-starts resolve in
// ≤ 3 s — this only kicks in for the slow tail.
const MAX_RETRIES = 7;
const RETRY_BASE_MS = 300;
const RETRY_CAP_MS = 3000;

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  if (
    msg.includes("Control plane request failed") ||
    msg.includes("connection timed out") ||
    msg.includes("Connection terminated unexpectedly") ||
    msg.includes("connect ECONNREFUSED") ||
    msg.includes("Too many connections") ||
    msg.includes("Can't reach database server") ||
    msg.includes("the database system is starting up")
  ) {
    return true;
  }
  const meta = (error as { meta?: { neon?: { retryable?: boolean } } }).meta;
  return meta?.neon?.retryable === true;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        const base = Math.min(
          RETRY_BASE_MS * Math.pow(2, attempt),
          RETRY_CAP_MS,
        );
        const jitter = Math.floor(Math.random() * 200);
        await new Promise((r) => setTimeout(r, base + jitter));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

const createPrismaClient = () =>
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  }).$extends({
    query: {
      $allOperations: ({ args, query }) => withRetry(() => query(args)),
    },
  });

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
