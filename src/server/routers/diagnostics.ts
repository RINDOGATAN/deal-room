// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A procedure that fails on purpose, so a test can prove what a person sees
 * when a procedure fails (a message they can act on, a reference id, no
 * stack trace). Off unless `FAILURE_PROBE_ENABLED=true`, and never on the
 * hosted production deployment whatever the variable says: when off it
 * answers NOT_FOUND like any unknown path.
 */

import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../trpc";

type Env = Record<string, string | undefined>;

export function failureProbeEnabled(env: Env): boolean {
  return env.FAILURE_PROBE_ENABLED === "true" && env.VERCEL_ENV !== "production";
}

export const diagnosticsRouter = createTRPCRouter({
  failureProbe: publicProcedure.query(() => {
    if (!failureProbeEnabled(process.env)) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }
    // The shape of a real programming error.
    const missing = undefined as unknown as { field: string };
    return missing.field;
  }),
});
