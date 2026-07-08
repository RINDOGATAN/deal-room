// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Gavel Webhook Handler
 *
 * Handles events from Gavel ADR:
 * - case.resolved — arbitration decision made
 * - escrow.released — stablecoin escrow released
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { createLogger } from "@/lib/logger";

const logger = createLogger("gavel-webhook");

const GAVEL_WEBHOOK_SECRET = process.env.GAVEL_WEBHOOK_SECRET;

function verifyGavelSignature(
  payload: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  return signature === `sha256=${expected}`;
}

export async function POST(request: NextRequest) {
  try {
    // Fail closed: refuse the webhook if the shared secret isn't configured.
    // An unset secret would otherwise leave this endpoint open to anonymous
    // dispute mutations.
    if (!GAVEL_WEBHOOK_SECRET) {
      logger.error(
        "GAVEL_WEBHOOK_SECRET is not set — refusing webhook. Configure on Vercel and redeploy.",
      );
      return NextResponse.json(
        { error: "Webhook receiver is misconfigured" },
        { status: 503 },
      );
    }

    const body = await request.text();
    const signature = request.headers.get("x-gavel-signature");

    if (!verifyGavelSignature(body, signature, GAVEL_WEBHOOK_SECRET)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 },
      );
    }

    const event = JSON.parse(body) as {
      type: string;
      data: {
        caseId: string;
        resolution?: Record<string, unknown>;
        escrowAmount?: number;
        releasedTo?: string;
      };
    };

    switch (event.type) {
      case "case.resolved": {
        const dispute = await prisma.agentDispute.findUnique({
          where: { gavelCaseId: event.data.caseId },
        });

        if (!dispute) {
          logger.warn("Gavel case.resolved for unknown case", { caseId: event.data.caseId });
          break;
        }

        await prisma.agentDispute.update({
          where: { id: dispute.id },
          data: {
            status: "RESOLVED",
            resolutionData: (event.data.resolution ?? undefined) as Prisma.InputJsonValue | undefined,
            resolvedAt: new Date(),
          },
        });

        logger.info("Dispute resolved", { disputeId: dispute.id, caseId: event.data.caseId });
        break;
      }

      case "escrow.released": {
        const dispute = await prisma.agentDispute.findUnique({
          where: { gavelCaseId: event.data.caseId },
        });

        if (!dispute) {
          logger.warn("Gavel escrow.released for unknown case", { caseId: event.data.caseId });
          break;
        }

        // Update dispute with escrow release info
        await prisma.agentDispute.update({
          where: { id: dispute.id },
          data: {
            resolutionData: {
              ...(dispute.resolutionData as Record<string, unknown> || {}),
              escrowReleased: true,
              escrowReleasedTo: event.data.releasedTo,
              escrowReleasedAt: new Date().toISOString(),
            } as Prisma.InputJsonValue,
          },
        });

        logger.info("Escrow released for dispute", {
          disputeId: dispute.id,
          caseId: event.data.caseId,
        });
        break;
      }

      default:
        logger.debug("Unhandled Gavel event type", { eventType: event.type });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("Gavel webhook error", { err: String(error) });
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
