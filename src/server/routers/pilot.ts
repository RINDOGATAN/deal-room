// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Hosted pilot status for the signed-in account: days of editing left and
 * the record ceilings. On the kit `hosted` is false and nothing is capped.
 */

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { getPilotStatus } from "../services/pilot";

export const pilotRouter = createTRPCRouter({
  status: protectedProcedure.query(({ ctx }) =>
    getPilotStatus(ctx.prisma, ctx.session.user.id),
  ),
});
