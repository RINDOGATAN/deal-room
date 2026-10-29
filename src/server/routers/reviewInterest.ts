// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { createTRPCRouter, rateLimitedPublicProcedure } from "../trpc";
import { reviewInterestInput, reviewInterestRow } from "@/lib/review-interest";

/**
 * Anonymous counter for the lawyer-review interest line on finished DPAs.
 * The strict input schema rejects any field or value beyond the allowed
 * ones; the row carries the event, the two answers and the language only
 * (no session, deal, IP or user agent is read into it).
 */
export const reviewInterestRouter = createTRPCRouter({
  record: rateLimitedPublicProcedure("review-interest")
    .input(reviewInterestInput)
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.reviewInterestEvent.create({ data: reviewInterestRow(input) });
      return { success: true };
    }),
});
