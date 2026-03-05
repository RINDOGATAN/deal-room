/**
 * Analytics tRPC Router — Layer 4: Analytics & Intelligence
 *
 * Proxies Cloud Intelligence API analytics endpoints.
 * All queries return null when DEALROOM_CLOUD_API_KEY is absent —
 * the UI shows blurred teaser data with an upgrade CTA.
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { cloudApi } from "@/lib/cloud-api";

export const analyticsRouter = createTRPCRouter({
  /** Negotiation benchmarks: avg rounds, time to completion, satisfaction */
  getBenchmarks: protectedProcedure
    .input(z.object({ contractType: z.string() }))
    .query(async ({ input }) => {
      return cloudApi.getBenchmarks(input.contractType);
    }),

  /** Clause popularity: which options get picked most often */
  getClausePopularity: protectedProcedure
    .input(
      z.object({
        contractType: z.string(),
        jurisdiction: z.string(),
      })
    )
    .query(async ({ input }) => {
      return cloudApi.getClausePopularity(
        input.contractType,
        input.jurisdiction
      );
    }),

  /** Deal activity: totals, completion rate, trends */
  getDealActivity: protectedProcedure
    .input(z.object({ organizationId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return cloudApi.getDealActivity(input?.organizationId);
    }),

  /** Check if cloud analytics are available */
  isAvailable: protectedProcedure.query(async () => {
    return { available: cloudApi.isAvailable };
  }),
});
