// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Daily cron — runs once per day, scheduled via vercel.json.
 *
 * Three jobs run in sequence. Each job is independent — if one fails,
 * the others still run, and the failure is reported in the response so
 * Vercel's cron logs surface it.
 *
 * 1. Signing-stall reminder
 *    For SigningRequests where expiresAt is between now+2 and now+4 days
 *    AND no reminder has been sent yet, email both parties (whoever has
 *    not signed yet) and stamp expiryReminderSentAt so the next run
 *    skips them.
 *
 * 2. Signing-stall expiry
 *    For SigningRequests past expiresAt that are still in PENDING / SENT
 *    / PARTIALLY_SIGNED, mark them EXPIRED, revert the deal status from
 *    SIGNING back to AGREED, write an audit-log entry, and email the
 *    parties so they know they can start over.
 *
 *    Once the row is EXPIRED, the unique-constraint on dealRoomId still
 *    blocks a new initiate. The next initiate call deletes the EXPIRED
 *    row inside its transaction (handled in the signing router) so the
 *    re-attempt can proceed.
 *
 * 3. Vetting-request expiry
 *    For RecommendationRequests past expiresAt that are still PENDING
 *    or ACCEPTED, mark them CANCELLED. No emails — the requester sees
 *    the badge change on next page load.
 *
 * Auth: caller must present the CRON_SECRET as a Bearer token. Vercel's
 * scheduled function runner sets this automatically when the env var
 * is configured. Any other caller is rejected with 401.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import {
  sendSigningExpiringSoonEmail,
  sendSigningExpiredEmail,
} from "@/lib/email";
import { createLogger } from "@/lib/logger";

const logger = createLogger("cron");

const CRON_SECRET = process.env.CRON_SECRET;

interface JobResult {
  ran: number;
  errors: number;
}

export async function GET(req: NextRequest) {
  // Refuse to run if the shared secret isn't configured. Better to fail
  // the cron loudly than to leave the endpoint open to anonymous calls.
  if (!CRON_SECRET) {
    logger.error("CRON_SECRET is not set — refusing to run daily cron.");
    return NextResponse.json(
      { error: "Cron is not configured on the server." },
      { status: 503 },
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const provided = authHeader.replace(/^Bearer\s+/i, "");
  if (provided !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const reminderJob = await runSigningReminderJob();
    const signingExpiryJob = await runSigningExpiryJob();
    const vettingExpiryJob = await runVettingExpiryJob();

    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      jobs: {
        signingReminders: reminderJob,
        signingExpiry: signingExpiryJob,
        vettingExpiry: vettingExpiryJob,
      },
    });
  } catch (error) {
    return apiError(error, "Daily cron failed");
  }
}

// ────────────────────────────────────────────────────────────
// Job 1 — signing reminders
// ────────────────────────────────────────────────────────────

async function runSigningReminderJob(): Promise<JobResult> {
  const now = Date.now();
  const minWindow = new Date(now + 2 * 86_400_000); // 2 days from now
  const maxWindow = new Date(now + 4 * 86_400_000); // 4 days from now
  let ran = 0;
  let errors = 0;

  const requests = await prisma.signingRequest.findMany({
    where: {
      status: { in: ["PENDING", "SENT", "PARTIALLY_SIGNED"] },
      expiresAt: { gte: minWindow, lte: maxWindow },
      expiryReminderSentAt: null,
    },
    include: {
      dealRoom: {
        select: {
          id: true,
          name: true,
          parties: {
            select: { role: true, email: true, name: true, user: { select: { email: true, name: true } } },
          },
        },
      },
    },
  });

  for (const sr of requests) {
    try {
      const daysRemaining = Math.max(
        1,
        Math.ceil((sr.expiresAt.getTime() - now) / 86_400_000),
      );

      // Email each party who hasn't signed yet. We don't know which side
      // has signed perfectly from this query alone (initiatorSignedAt /
      // respondentSignedAt tell us). Send to whoever's pending side.
      const initiator = sr.dealRoom?.parties.find((p) => p.role === "INITIATOR");
      const respondent = sr.dealRoom?.parties.find((p) => p.role === "RESPONDENT");

      const recipients: { to: string; partyName: string }[] = [];
      if (!sr.initiatorSignedAt && initiator) {
        const to = initiator.user?.email ?? initiator.email;
        if (to) recipients.push({ to, partyName: initiator.user?.name ?? initiator.name ?? "there" });
      }
      if (!sr.respondentSignedAt && respondent) {
        const to = respondent.user?.email ?? respondent.email;
        if (to) recipients.push({ to, partyName: respondent.user?.name ?? respondent.name ?? "there" });
      }

      for (const r of recipients) {
        await sendSigningExpiringSoonEmail({
          to: r.to,
          partyName: r.partyName,
          dealName: sr.dealRoom?.name ?? "your contract",
          daysRemaining,
          dealRoomId: sr.dealRoomId,
        });
      }

      await prisma.signingRequest.update({
        where: { id: sr.id },
        data: { expiryReminderSentAt: new Date() },
      });
      ran++;
    } catch (err) {
      errors++;
      logger.error("signingReminders: failed on request", {
        requestId: sr.id,
        err: String(err),
      });
    }
  }

  return { ran, errors };
}

// ────────────────────────────────────────────────────────────
// Job 2 — signing expiry
// ────────────────────────────────────────────────────────────

async function runSigningExpiryJob(): Promise<JobResult> {
  const now = new Date();
  let ran = 0;
  let errors = 0;

  const requests = await prisma.signingRequest.findMany({
    where: {
      status: { in: ["PENDING", "SENT", "PARTIALLY_SIGNED"] },
      expiresAt: { lt: now },
    },
    include: {
      dealRoom: {
        select: {
          id: true,
          name: true,
          parties: {
            select: { email: true, name: true, user: { select: { email: true, name: true } } },
          },
        },
      },
    },
  });

  for (const sr of requests) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.signingRequest.update({
          where: { id: sr.id },
          data: { status: "EXPIRED" },
        });
        await tx.dealRoom.updateMany({
          where: { id: sr.dealRoomId, status: "SIGNING" },
          data: { status: "AGREED" },
        });
        await tx.auditLog.create({
          data: {
            dealRoomId: sr.dealRoomId,
            userId: null,
            action: "SIGNING_EXPIRED",
            details: {
              signingRequestId: sr.id,
              expiredAt: now.toISOString(),
            },
          },
        });
      });

      // Email parties — outside the transaction so a Resend hiccup
      // doesn't roll back the database write.
      for (const party of sr.dealRoom?.parties ?? []) {
        const to = party.user?.email ?? party.email;
        if (!to) continue;
        await sendSigningExpiredEmail({
          to,
          partyName: party.user?.name ?? party.name ?? "there",
          dealName: sr.dealRoom?.name ?? "your contract",
          dealRoomId: sr.dealRoomId,
        });
      }

      ran++;
    } catch (err) {
      errors++;
      logger.error("signingExpiry: failed on request", {
        requestId: sr.id,
        err: String(err),
      });
    }
  }

  return { ran, errors };
}

// ────────────────────────────────────────────────────────────
// Job 3 — vetting (RecommendationRequest) expiry
// ────────────────────────────────────────────────────────────

async function runVettingExpiryJob(): Promise<JobResult> {
  const now = new Date();
  const result = await prisma.recommendationRequest.updateMany({
    where: {
      status: { in: ["PENDING", "ACCEPTED"] },
      expiresAt: { lt: now },
    },
    data: { status: "CANCELLED" },
  });

  return { ran: result.count, errors: 0 };
}
