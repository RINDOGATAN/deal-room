// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Revenue Share Service
 *
 * Creates RevenueEvent records and triggers Stripe Connect transfers
 * when skill authors should receive their revenue share.
 */

import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const logger = createLogger("agent-revenue");

export async function createDealRevenueEvent(params: {
  skillPackageId: string;
  authorId: string;
  grossAmount: number;
  revenueSharePct: number;
  currency?: string;
}) {
  const authorAmount = Math.floor(params.grossAmount * params.revenueSharePct / 100);
  const platformAmount = params.grossAmount - authorAmount;

  const event = await prisma.revenueEvent.create({
    data: {
      skillPackageId: params.skillPackageId,
      authorId: params.authorId,
      eventType: "DEAL_COMPLETION",
      grossAmount: params.grossAmount,
      platformAmount,
      authorAmount,
      currency: params.currency || "eur",
    },
  });

  // Attempt Stripe Connect transfer
  if (authorAmount > 0) {
    const authorProfile = await prisma.lawyerProfile.findFirst({
      where: { userId: params.authorId },
    });

    if (authorProfile?.stripeConnectAccountId) {
      try {
        const { createConnectTransfer } = await import("@/lib/stripe");
        const transfer = await createConnectTransfer({
          amount: authorAmount,
          currency: params.currency || "eur",
          destinationAccountId: authorProfile.stripeConnectAccountId,
          description: `Deal completion revenue share`,
          metadata: {
            revenueEventId: event.id,
            skillPackageId: params.skillPackageId,
          },
        });

        await prisma.revenueEvent.update({
          where: { id: event.id },
          data: {
            stripeTransferId: transfer.id,
            settledAt: new Date(),
          },
        });
      } catch (err) {
        logger.error("Failed Connect transfer for revenue event", {
          revenueEventId: event.id,
          err: String(err),
        });
      }
    }
  }

  return event;
}
