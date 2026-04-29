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
      console.error(
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
          console.warn(
            `Gavel case.resolved for unknown case: ${event.data.caseId}`
          );
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

        console.log(
          `Dispute ${dispute.id} resolved for case ${event.data.caseId}`
        );
        break;
      }

      case "escrow.released": {
        const dispute = await prisma.agentDispute.findUnique({
          where: { gavelCaseId: event.data.caseId },
        });

        if (!dispute) {
          console.warn(
            `Gavel escrow.released for unknown case: ${event.data.caseId}`
          );
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

        console.log(
          `Escrow released for dispute ${dispute.id}, case ${event.data.caseId}`
        );
        break;
      }

      default:
        console.log(`Unhandled Gavel event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Gavel webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
