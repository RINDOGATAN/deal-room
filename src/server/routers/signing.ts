// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  sendSigningInitiatedEmail,
  sendCounterpartySignedEmail,
  sendFirmasSigningEmail,
} from "@/lib/email";
import { certificationService } from "@/lib/certification-client";
import { generateContractData } from "@/server/services/document/generator";
import { createLogger } from "@/lib/logger";

const logger = createLogger("signing");

/**
 * Best-effort capture of who and where a signature came from.
 * Reads from x-forwarded-for (set by Vercel for the original
 * client IP) and falls back to x-real-ip; user-agent is read
 * straight off the header. Truncates the UA so a malicious or
 * runaway client can't blow up the column. Returns null fields
 * if the headers are missing — better honest gaps than fake
 * "127.0.0.1" data in audit trails.
 */
async function captureSignatureForensics(): Promise<{
  ip: string | null;
  ua: string | null;
}> {
  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    const ip = xff?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    const uaRaw = h.get("user-agent");
    const ua = uaRaw ? uaRaw.slice(0, 500) : null;
    return { ip, ua };
  } catch {
    return { ip: null, ua: null };
  }
}

const signingDetailsSchema = z.object({
  legalName: z.string().min(1),
  address: z.string().min(1),
  taxId: z.string().optional(),
  signatoryName: z.string().min(1),
  signatoryTitle: z.string().min(1),
  /**
   * Which role the filling party takes when completing a single-party (SOLO)
   * document that has asymmetric party roles (currently DPA: Controller vs
   * Processor). The other role's block is left blank in the output. Absent on
   * two-party deals and non-DPA skills, where roles are fixed by position.
   */
  fillRole: z.enum(["CONTROLLER", "PROCESSOR"]).optional(),
});

export type SigningDetails = z.infer<typeof signingDetailsSchema>;

export const signingRouter = createTRPCRouter({
  getSigningDetails: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .query(async ({ ctx, input }) => {
      const parties = await ctx.prisma.dealRoomParty.findMany({
        where: { dealRoomId: input.dealRoomId },
        select: {
          id: true,
          role: true,
          userId: true,
          name: true,
          company: true,
          signingDetails: true,
        },
      });

      const currentParty = parties.find(
        (p) => p.userId === ctx.session.user.id
      );
      if (!currentParty) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this deal",
        });
      }

      const otherParty = parties.find(
        (p) => p.userId !== ctx.session.user.id
      );

      return {
        own: {
          partyId: currentParty.id,
          role: currentParty.role,
          signingDetails: currentParty.signingDetails as SigningDetails | null,
          name: currentParty.name,
          company: currentParty.company,
        },
        other: otherParty
          ? {
              role: otherParty.role,
              signingDetails: otherParty.signingDetails as SigningDetails | null,
            }
          : null,
      };
    }),

  submitSigningDetails: protectedProcedure
    .input(
      z.object({
        dealRoomId: z.string(),
        details: signingDetailsSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const party = await ctx.prisma.dealRoomParty.findFirst({
        where: {
          dealRoomId: input.dealRoomId,
          userId: ctx.session.user.id,
        },
        include: {
          dealRoom: {
            include: { signingRequest: true },
          },
        },
      });

      if (!party) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this deal",
        });
      }

      // Check if party has already signed
      const sr = party.dealRoom.signingRequest;
      if (sr) {
        const alreadySigned =
          (party.role === "INITIATOR" && sr.initiatorSignedAt) ||
          (party.role === "RESPONDENT" && sr.respondentSignedAt);
        if (alreadySigned) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot edit signing details after signing",
          });
        }
      }

      const updated = await ctx.prisma.dealRoomParty.update({
        where: { id: party.id },
        data: { signingDetails: input.details },
      });

      // For solo asymmetric-role contracts (DPA), the role choice lives on the
      // deal so it applies to the direct-download path too — mirror any edit
      // made here onto the deal's soloFillRole column.
      if (input.details.fillRole && party.dealRoom.dealMode === "SOLO") {
        await ctx.prisma.dealRoom.update({
          where: { id: input.dealRoomId },
          data: { soloFillRole: input.details.fillRole },
        });
      }

      await ctx.prisma.auditLog.create({
        data: {
          dealRoomId: input.dealRoomId,
          userId: ctx.session.user.id,
          action: "SIGNING_DETAILS_SUBMITTED",
          details: {
            partyRole: party.role,
            legalName: input.details.legalName,
          },
        },
      });

      return updated.signingDetails as SigningDetails;
    }),

  getRequest: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .query(async ({ ctx, input }) => {
      const signingRequest = await ctx.prisma.signingRequest.findFirst({
        where: { dealRoomId: input.dealRoomId },
        orderBy: { createdAt: "desc" },
      });

      return signingRequest;
    }),

  initiate: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify user has access to this deal
      const party = await ctx.prisma.dealRoomParty.findFirst({
        where: {
          dealRoomId: input.dealRoomId,
          userId: ctx.session.user.id,
        },
        include: {
          dealRoom: {
            include: {
              clauses: true,
              parties: {
                include: {
                  user: true,
                },
              },
              contractTemplate: true,
            },
          },
        },
      });

      if (!party) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this deal",
        });
      }

      // Check all clauses are agreed
      const allAgreed = party.dealRoom.clauses.every((c) => c.status === "AGREED");
      if (!allAgreed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "All clauses must be agreed upon before signing",
        });
      }

      // Check no active attorney reviews are in progress
      const activeReviews = party.dealRoom.parties.filter(
        (p) => p.attorneyReviewRequested && !p.attorneyReviewApprovedAt
      );
      if (activeReviews.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot initiate signing while attorney review is in progress",
        });
      }

      // Check joint counsel status — block if requested but neither acknowledged nor declined
      const deal = party.dealRoom;
      if (
        deal.jointCounselRequestedAt &&
        !deal.jointCounselAcknowledgedAt &&
        !deal.jointCounselDeclinedAt
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot initiate signing while joint counsel request is pending",
        });
      }

      // Dual-fill requirement. Both parties must have submitted their
      // execution details before we can flip AGREED → SIGNING. Without
      // this, one party can race ahead and lock the deal into a state
      // where the slower party's address / tax ID / signatory will never
      // make it into the rendered contract. SOLO mode (no respondent)
      // only requires the initiator's details.
      const initiatorParty = deal.parties.find((p) => p.role === "INITIATOR");
      const respondentParty = deal.parties.find((p) => p.role === "RESPONDENT");
      const isSolo = deal.dealMode === "SOLO";
      if (!initiatorParty?.signingDetails) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "The initiator must add execution details before signing can start",
        });
      }
      if (!isSolo && !respondentParty?.signingDetails) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "The respondent must add execution details before signing can start",
        });
      }

      // Check if there's already an active signing request
      const existingRequest = await ctx.prisma.signingRequest.findFirst({
        where: {
          dealRoomId: input.dealRoomId,
          status: { in: ["PENDING", "PARTIALLY_SIGNED"] },
        },
      });

      if (existingRequest) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A signing request is already in progress",
        });
      }

      // Begin certification ceremony (degrades gracefully without API key)
      let ceremonyId: string | null = null;
      let documentHash: string | null = null;
      try {
        const contractData = await generateContractData(input.dealRoomId);
        if (contractData) {
          const ceremony = await certificationService.beginCeremony(
            input.dealRoomId,
            contractData
          );
          if (ceremony.certified) {
            ceremonyId = ceremony.ceremonyId;
            documentHash = ceremony.documentHash;
          }
        }
      } catch (error) {
        logger.error("Certification ceremony failed (continuing uncertified)", { err: String(error) });
      }

      // Atomic AGREED → SIGNING transition. If two parties click "Initiate
      // Signing" concurrently, both pass the existingRequest check above,
      // but only the writer that finds the deal in AGREED state wins this
      // transaction. The loser sees CONFLICT and the user can refresh.
      const signingRequest = await ctx.prisma.$transaction(async (tx) => {
        const claimed = await tx.dealRoom.updateMany({
          where: { id: input.dealRoomId, status: "AGREED" },
          data: { status: "SIGNING" },
        });
        if (claimed.count === 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Another party already initiated signing for this deal",
          });
        }
        // The dealRoomId column on signing_requests has a unique
        // constraint, so any old EXPIRED / DECLINED row from a
        // previous attempt has to be cleared before we insert the
        // new one. The historical record is preserved in the audit log.
        await tx.signingRequest.deleteMany({
          where: {
            dealRoomId: input.dealRoomId,
            status: { in: ["EXPIRED", "DECLINED"] },
          },
        });
        return tx.signingRequest.create({
          data: {
            dealRoomId: input.dealRoomId,
            provider: "type-to-sign",
            status: "PENDING",
            externalId: `sign_${Date.now()}`,
            documentUrl: null,
            ceremonyId,
            documentHash,
            // 14-day expiry. Used by the deal-detail surface to warn
            // when a signing has stalled — neither auto-cancellation
            // nor reminder emails are wired yet (deliberate scope cap).
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        });
      });

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          dealRoomId: input.dealRoomId,
          userId: ctx.session.user.id,
          action: "SIGNING_INITIATED",
          details: {
            initiatedBy: ctx.session.user.email,
            documentId: signingRequest.externalId,
          },
        },
      });

      // Notify both parties that signing has been initiated
      const dealName = party.dealRoom.contractTemplate?.displayName || "Deal";
      const initiatedByName = party.name || ctx.session.user.email || "A party";

      for (const p of party.dealRoom.parties) {
        if (p.user?.email) {
          try {
            await sendSigningInitiatedEmail({
              to: p.user.email,
              partyName: p.name || p.user.email,
              dealName,
              initiatedByName,
              dealRoomId: input.dealRoomId,
            });
          } catch (error) {
            logger.error("Failed to send signing initiated email", { err: String(error) });
          }
        }
      }

      return signingRequest;
    }),

  recordSignature: protectedProcedure
    .input(
      z.object({
        signingRequestId: z.string(),
        partyRole: z.enum(["INITIATOR", "RESPONDENT"]),
        signature: z.string().min(1, "Signature is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const signingRequest = await ctx.prisma.signingRequest.findUnique({
        where: { id: input.signingRequestId },
        include: {
          dealRoom: {
            include: {
              parties: {
                include: { user: true },
              },
              contractTemplate: true,
            },
          },
        },
      });

      if (!signingRequest) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Signing request not found",
        });
      }

      // Verify user is the correct party
      const party = signingRequest.dealRoom.parties.find(
        (p) => p.userId === ctx.session.user.id && p.role === input.partyRole
      );

      if (!party) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not authorized to sign as this party",
        });
      }

      // Require signing details before signing — both your own and
      // every counterparty's. Without all parties' details the rendered
      // contract has "—" placeholders where their name / address /
      // signatory belong, which makes any resulting signed document
      // incomplete.
      if (!party.signingDetails) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You must submit your execution details before signing",
        });
      }
      const missingDetailsParty = signingRequest.dealRoom.parties.find(
        (p) => p.id !== party.id && !p.signingDetails,
      );
      if (missingDetailsParty) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot sign yet — ${missingDetailsParty.name || "the other party"} has not added their signing details. The contract would be missing their information.`,
        });
      }

      // Record signature with certification (degrades gracefully)
      if (signingRequest.ceremonyId) {
        try {
          await certificationService.recordSignature(
            signingRequest.ceremonyId,
            input.partyRole,
            ctx.session.user.email || party.email || "",
            party.name || ctx.session.user.name || "",
          );
        } catch (error) {
          logger.error("Certification signature recording failed", { err: String(error) });
        }
      }

      const now = new Date();
      const forensics = await captureSignatureForensics();
      const updateData: Record<string, Date | string | null> = {};

      if (input.partyRole === "INITIATOR") {
        if (signingRequest.initiatorSignedAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Party A has already signed",
          });
        }
        updateData.initiatorSignedAt = now;
        updateData.initiatorSignature = input.signature;
        updateData.initiatorSignatureIp = forensics.ip;
        updateData.initiatorSignatureUa = forensics.ua;
      } else {
        if (signingRequest.respondentSignedAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Party B has already signed",
          });
        }
        updateData.respondentSignedAt = now;
        updateData.respondentSignature = input.signature;
        updateData.respondentSignatureIp = forensics.ip;
        updateData.respondentSignatureUa = forensics.ua;
      }

      // Check if both parties have now signed
      const partyASigned = input.partyRole === "INITIATOR" || signingRequest.initiatorSignedAt;
      const partyBSigned = input.partyRole === "RESPONDENT" || signingRequest.respondentSignedAt;

      if (partyASigned && partyBSigned) {
        updateData.status = "COMPLETED";
        updateData.completedAt = now;
        // In production, this would be the URL to the signed document
        updateData.documentUrl = `/api/documents/${signingRequest.externalId}/signed`;
      } else {
        updateData.status = "PARTIALLY_SIGNED";
      }

      const updated = await ctx.prisma.signingRequest.update({
        where: { id: input.signingRequestId },
        data: updateData,
      });

      // If completed, update deal status
      if (updated.status === "COMPLETED") {
        await ctx.prisma.dealRoom.update({
          where: { id: signingRequest.dealRoomId },
          data: { status: "COMPLETED" },
        });

        await ctx.prisma.auditLog.create({
          data: {
            dealRoomId: signingRequest.dealRoomId,
            userId: ctx.session.user.id,
            action: "DEAL_COMPLETED",
            details: {
              completedAt: now.toISOString(),
              documentId: signingRequest.externalId,
            },
          },
        });
      }

      await ctx.prisma.auditLog.create({
        data: {
          dealRoomId: signingRequest.dealRoomId,
          userId: ctx.session.user.id,
          action: "SIGNATURE_RECORDED",
          details: {
            partyRole: input.partyRole,
            signedAt: now.toISOString(),
          },
        },
      });

      // Notify the other party when one side signs (partially signed)
      if (updated.status === "PARTIALLY_SIGNED") {
        const otherParty = signingRequest.dealRoom.parties.find(
          (p) => p.role !== input.partyRole
        );
        if (otherParty?.user?.email) {
          const dealName = signingRequest.dealRoom.contractTemplate?.displayName || "Deal";
          const signerName = party.name || ctx.session.user.email || "The other party";
          try {
            await sendCounterpartySignedEmail({
              to: otherParty.user.email,
              partyName: otherParty.name || otherParty.user.email,
              dealName,
              signerName,
              dealRoomId: signingRequest.dealRoomId,
            });
          } catch (error) {
            logger.error("Failed to send counterparty signed email", { err: String(error) });
          }
        }
      }

      return updated;
    }),

  // Webhook handler for e-signature provider callbacks
  handleWebhook: protectedProcedure
    .input(
      z.object({
        externalId: z.string(),
        event: z.enum(["VIEWED", "SIGNED", "COMPLETED", "DECLINED", "VOIDED"]),
        signerEmail: z.string().optional(),
        signedAt: z.string().optional(),
        documentUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const signingRequest = await ctx.prisma.signingRequest.findFirst({
        where: { externalId: input.externalId },
        include: {
          dealRoom: {
            include: {
              parties: {
                include: { user: true },
              },
            },
          },
        },
      });

      if (!signingRequest) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Signing request not found",
        });
      }

      // Handle different webhook events
      switch (input.event) {
        case "SIGNED":
          // Determine which party signed based on email
          const signerParty = signingRequest.dealRoom.parties.find(
            (p) => p.user?.email === input.signerEmail
          );

          if (signerParty) {
            const signedAt = input.signedAt ? new Date(input.signedAt) : new Date();

            if (signerParty.role === "INITIATOR" && !signingRequest.initiatorSignedAt) {
              await ctx.prisma.signingRequest.update({
                where: { id: signingRequest.id },
                data: {
                  initiatorSignedAt: signedAt,
                  status: signingRequest.respondentSignedAt ? "COMPLETED" : "PARTIALLY_SIGNED",
                },
              });
            } else if (signerParty.role === "RESPONDENT" && !signingRequest.respondentSignedAt) {
              await ctx.prisma.signingRequest.update({
                where: { id: signingRequest.id },
                data: {
                  respondentSignedAt: signedAt,
                  status: signingRequest.initiatorSignedAt ? "COMPLETED" : "PARTIALLY_SIGNED",
                },
              });
            }
          }
          break;

        case "COMPLETED":
          await ctx.prisma.signingRequest.update({
            where: { id: signingRequest.id },
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
              documentUrl: input.documentUrl,
            },
          });

          await ctx.prisma.dealRoom.update({
            where: { id: signingRequest.dealRoomId },
            data: { status: "COMPLETED" },
          });
          break;

        case "DECLINED":
        case "VOIDED":
          await ctx.prisma.signingRequest.update({
            where: { id: signingRequest.id },
            data: { status: "DECLINED" },
          });
          break;
      }

      return { success: true };
    }),

  /**
   * Self-mint (or other-party-mint) a Firmas hand-off. Each party can
   * choose to sign with the Firmas wallet for biometric mobile identity
   * attestation. Defaults to minting for the caller's own role; the
   * INITIATOR may additionally mint on behalf of the respondent (the
   * original "send invitation by email" use case).
   *
   * On call:
   *   1. Validates dual-fill of execution details + agreement / review /
   *      joint-counsel preconditions; auto-initiates the SigningRequest
   *      if none exists yet.
   *   2. Mints a UUID v4 into the appropriate <role>FirmasToken column;
   *      idempotent — re-pressing returns the same token but bumps the
   *      sentAt stamp.
   *   3. If `forRole !== caller's role`, emails the target party the
   *      link. Otherwise no email (caller is already on desktop and
   *      copies the link onto their own phone).
   *
   * The firmas-callback receiver at `/api/signing/firmas-callback`
   * looks up the SigningRequest by EITHER token, determines the
   * signing party from which token matched, and updates the matching
   * <role>SignedAt + <role>SignedBundle columns.
   */
  requestFirmasHandoff: protectedProcedure
    .input(
      z.object({
        dealRoomId: z.string(),
        forRole: z.enum(["INITIATOR", "RESPONDENT"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const callerParty = await ctx.prisma.dealRoomParty.findFirst({
        where: { dealRoomId: input.dealRoomId, userId: ctx.session.user.id },
        include: {
          dealRoom: {
            include: {
              clauses: true,
              parties: { include: { user: true } },
              contractTemplate: true,
            },
          },
        },
      });
      if (!callerParty) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this deal",
        });
      }

      // Permission model: anyone can self-mint; only the initiator can
      // mint for the respondent (the "send the invite" use case). A
      // respondent can't mint on the initiator's behalf — that would
      // let her hijack the initiator's signing-method choice.
      const forRole = input.forRole ?? callerParty.role;
      if (forRole !== callerParty.role && callerParty.role !== "INITIATOR") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only request a Firmas hand-off for yourself",
        });
      }

      const deal = callerParty.dealRoom;
      const initiatorParty = deal.parties.find((p) => p.role === "INITIATOR");
      const respondentParty = deal.parties.find((p) => p.role === "RESPONDENT");
      const isSolo = deal.dealMode === "SOLO";

      if (forRole === "RESPONDENT" && isSolo) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Solo-mode deals have no respondent",
        });
      }
      const targetParty = forRole === "INITIATOR" ? initiatorParty : respondentParty;
      if (!targetParty) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `The ${forRole.toLowerCase()} party is not on this deal yet`,
        });
      }

      // Dual-fill requirement — Firmas needs to render the contract
      // bundle with both parties' execution details. Enforced
      // unconditionally (independently of whether a SigningRequest
      // already exists) so the Firmas hand-off never produces a
      // half-formed contract.
      if (!initiatorParty?.signingDetails) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Initiator must add execution details before signing can start",
        });
      }
      if (!isSolo && !respondentParty?.signingDetails) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Respondent must add execution details before signing can start",
        });
      }

      // Load (or create) the SigningRequest. Safety checks mirror
      // signing.initiate so the two paths stay interchangeable.
      let signingRequest = await ctx.prisma.signingRequest.findUnique({
        where: { dealRoomId: input.dealRoomId },
      });

      if (!signingRequest) {
        const allAgreed = deal.clauses.every((c) => c.status === "AGREED");
        if (!allAgreed) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "All clauses must be agreed upon before signing",
          });
        }
        const activeReviews = deal.parties.filter(
          (p) => p.attorneyReviewRequested && !p.attorneyReviewApprovedAt,
        );
        if (activeReviews.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot initiate signing while attorney review is in progress",
          });
        }
        if (
          deal.jointCounselRequestedAt &&
          !deal.jointCounselAcknowledgedAt &&
          !deal.jointCounselDeclinedAt
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot initiate signing while joint counsel request is pending",
          });
        }

        let ceremonyId: string | null = null;
        let documentHash: string | null = null;
        try {
          const contractData = await generateContractData(input.dealRoomId);
          if (contractData) {
            const ceremony = await certificationService.beginCeremony(
              input.dealRoomId,
              contractData,
            );
            if (ceremony.certified) {
              ceremonyId = ceremony.ceremonyId;
              documentHash = ceremony.documentHash;
            }
          }
        } catch (error) {
          logger.error("Certification ceremony failed (continuing uncertified)", { err: String(error) });
        }

        signingRequest = await ctx.prisma.$transaction(async (tx) => {
          const claimed = await tx.dealRoom.updateMany({
            where: { id: input.dealRoomId, status: "AGREED" },
            data: { status: "SIGNING" },
          });
          if (claimed.count === 0) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Another party already initiated signing for this deal",
            });
          }
          await tx.signingRequest.deleteMany({
            where: {
              dealRoomId: input.dealRoomId,
              status: { in: ["EXPIRED", "DECLINED"] },
            },
          });
          return tx.signingRequest.create({
            data: {
              dealRoomId: input.dealRoomId,
              provider: "firmas",
              status: "PENDING",
              externalId: `sign_${Date.now()}`,
              documentUrl: null,
              ceremonyId,
              documentHash,
              expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            },
          });
        });

        await ctx.prisma.auditLog.create({
          data: {
            dealRoomId: input.dealRoomId,
            userId: ctx.session.user.id,
            action: "SIGNING_INITIATED",
            details: {
              initiatedBy: ctx.session.user.email,
              documentId: signingRequest.externalId,
              via: "firmas",
            },
          },
        });
      }

      if (
        signingRequest.status === "COMPLETED" ||
        signingRequest.status === "DECLINED" ||
        signingRequest.status === "EXPIRED"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot send a ${signingRequest.status.toLowerCase()} signing request to Firmas`,
        });
      }

      // Already-signed guard. Once a party's signature is recorded,
      // there's nothing for them to do in the Firmas app — minting a
      // fresh token would silently shadow the one they signed with.
      const alreadySigned =
        forRole === "INITIATOR"
          ? !!signingRequest.initiatorSignedAt
          : !!signingRequest.respondentSignedAt;
      if (alreadySigned) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${forRole === "INITIATOR" ? "Initiator" : "Respondent"} has already signed`,
        });
      }

      // Mint (or reuse) the role-specific token.
      const existingToken =
        forRole === "INITIATOR"
          ? signingRequest.initiatorFirmasToken
          : signingRequest.respondentFirmasToken;
      const token = existingToken ?? crypto.randomUUID();

      const tokenUpdate =
        forRole === "INITIATOR"
          ? { initiatorFirmasToken: token, initiatorFirmasSentAt: new Date() }
          : { respondentFirmasToken: token, respondentFirmasSentAt: new Date() };

      const updated = await ctx.prisma.signingRequest.update({
        where: { id: signingRequest.id },
        data: {
          ...tokenUpdate,
          status: signingRequest.status === "PENDING" ? "SENT" : signingRequest.status,
        },
      });

      // Universal Link on iOS/Android (opens the Firmas app if
      // installed); falls back to the mobile-web signer in Safari/
      // Chrome otherwise.
      const firmasBase = process.env.FIRMAS_BASE_URL ?? "https://www.firmas.io";
      const url = `${firmasBase}/sign/${token}`;

      // Email the target party only when caller is acting on someone
      // else's behalf (the "initiator sends respondent a link" case).
      // Self-mint: no email — caller is on desktop and will scan/copy
      // the link onto their own phone.
      let emailedTo: string | null = null;
      if (forRole !== callerParty.role) {
        const targetEmail = targetParty.user?.email ?? targetParty.email ?? null;
        if (targetEmail) {
          const dealName = deal.contractTemplate?.displayName || "contract";
          const senderName =
            callerParty.name || ctx.session.user.email || "Your counterparty";
          try {
            await sendFirmasSigningEmail({
              to: targetEmail,
              initiatorName: senderName,
              contractType: dealName,
              signUrl: url,
            });
            emailedTo = targetEmail;
          } catch (error) {
            logger.error("Failed to send Firmas signing email", { err: String(error) });
          }
        }
      }

      return {
        token,
        sentAt:
          forRole === "INITIATOR"
            ? updated.initiatorFirmasSentAt
            : updated.respondentFirmasSentAt,
        url,
        forRole,
        emailedTo,
      };
    }),

  /**
   * Per-party Firmas poller. Returns the hand-off state for both
   * parties so the calling UI can render the live "waiting → signed"
   * transition without having to know which role it is. Surfaces only
   * the attested fields the card renders — never the full
   * SignedReceipt on every tick.
   */
  firmasStatus: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .query(async ({ ctx, input }) => {
      const party = await ctx.prisma.dealRoomParty.findFirst({
        where: { dealRoomId: input.dealRoomId, userId: ctx.session.user.id },
        select: { id: true },
      });
      if (!party) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this deal",
        });
      }

      const sr = await ctx.prisma.signingRequest.findUnique({
        where: { dealRoomId: input.dealRoomId },
        select: {
          status: true,
          completedAt: true,
          initiatorFirmasToken: true,
          initiatorFirmasSentAt: true,
          initiatorSignedAt: true,
          initiatorSignedBundle: true,
          respondentFirmasToken: true,
          respondentFirmasSentAt: true,
          respondentSignedAt: true,
          respondentSignedBundle: true,
        },
      });
      if (!sr) return null;

      type Bundle = {
        attestedGivenName?: string | null;
        attestedFamilyName?: string | null;
        attestedIdRegion?: string | null;
      };
      const projectBundle = (b: unknown) => {
        const bundle = b as Bundle | null;
        return {
          attestedName: bundle
            ? [bundle.attestedGivenName, bundle.attestedFamilyName]
                .filter(Boolean)
                .join(" ") || null
            : null,
          attestedRegion: bundle?.attestedIdRegion ?? null,
        };
      };

      return {
        status: sr.status,
        completedAt: sr.completedAt,
        initiator: {
          firmasToken: sr.initiatorFirmasToken,
          firmasSentAt: sr.initiatorFirmasSentAt,
          signedAt: sr.initiatorSignedAt,
          ...projectBundle(sr.initiatorSignedBundle),
        },
        respondent: {
          firmasToken: sr.respondentFirmasToken,
          firmasSentAt: sr.respondentFirmasSentAt,
          signedAt: sr.respondentSignedAt,
          ...projectBundle(sr.respondentSignedBundle),
        },
      };
    }),

  /**
   * Cancel a Firmas hand-off the caller had requested for themselves
   * but hasn't yet signed. Clears the caller's role-specific token +
   * sent-at so they can switch back to type-to-sign (or re-mint
   * fresh). Does NOT touch the signature columns — those only get
   * cleared by undoSignature. If the caller already signed via this
   * token, this errors out and the user has to use undoSignature
   * instead (which has stricter preconditions).
   */
  cancelFirmasHandoff: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const party = await ctx.prisma.dealRoomParty.findFirst({
        where: { dealRoomId: input.dealRoomId, userId: ctx.session.user.id },
        include: { dealRoom: { include: { signingRequest: true } } },
      });
      if (!party) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this deal",
        });
      }
      const sr = party.dealRoom.signingRequest;
      if (!sr) return { ok: true };

      const alreadySigned =
        party.role === "INITIATOR"
          ? !!sr.initiatorSignedAt
          : !!sr.respondentSignedAt;
      if (alreadySigned) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use undoSignature instead — your signature has already been recorded",
        });
      }

      const clearData =
        party.role === "INITIATOR"
          ? { initiatorFirmasToken: null, initiatorFirmasSentAt: null }
          : { respondentFirmasToken: null, respondentFirmasSentAt: null };

      await ctx.prisma.signingRequest.update({
        where: { id: sr.id },
        data: clearData,
      });

      await ctx.prisma.auditLog.create({
        data: {
          dealRoomId: input.dealRoomId,
          userId: ctx.session.user.id,
          action: "FIRMAS_HANDOFF_CANCELLED",
          details: { partyRole: party.role },
        },
      });

      return { ok: true };
    }),

  /**
   * Undo the caller's signature. Only allowed when the OTHER party
   * has NOT yet signed — once the counterparty has committed, the
   * one-way invariant kicks in (no rollback after dual signature).
   * Clears the caller's signedAt + signature + signedBundle + any
   * Firmas token they had minted, so they can choose a fresh signing
   * method on the next attempt.
   */
  undoSignature: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const party = await ctx.prisma.dealRoomParty.findFirst({
        where: { dealRoomId: input.dealRoomId, userId: ctx.session.user.id },
        include: { dealRoom: { include: { signingRequest: true } } },
      });
      if (!party) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this deal",
        });
      }
      const sr = party.dealRoom.signingRequest;
      if (!sr) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No signing in progress for this deal",
        });
      }

      const mySignedAt =
        party.role === "INITIATOR" ? sr.initiatorSignedAt : sr.respondentSignedAt;
      if (!mySignedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You haven't signed yet — nothing to undo",
        });
      }

      const otherSignedAt =
        party.role === "INITIATOR" ? sr.respondentSignedAt : sr.initiatorSignedAt;
      if (otherSignedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The other party has already signed; this contract is committed",
        });
      }

      const clearData =
        party.role === "INITIATOR"
          ? {
              initiatorSignedAt: null,
              initiatorSignature: null,
              initiatorSignedBundle: Prisma.DbNull,
              initiatorFirmasToken: null,
              initiatorFirmasSentAt: null,
              initiatorSignatureIp: null,
              initiatorSignatureUa: null,
            }
          : {
              respondentSignedAt: null,
              respondentSignature: null,
              respondentSignedBundle: Prisma.DbNull,
              respondentFirmasToken: null,
              respondentFirmasSentAt: null,
              respondentSignatureIp: null,
              respondentSignatureUa: null,
            };

      // If status was PARTIALLY_SIGNED, the only signature was this
      // one — revert to SENT (signing-in-progress, nobody signed).
      // Otherwise leave status alone; it was set by the other path.
      const nextStatus = sr.status === "PARTIALLY_SIGNED" ? "SENT" : sr.status;

      await ctx.prisma.signingRequest.update({
        where: { id: sr.id },
        data: {
          ...clearData,
          status: nextStatus,
          completedAt: null,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          dealRoomId: input.dealRoomId,
          userId: ctx.session.user.id,
          action: "SIGNATURE_UNDONE",
          details: { partyRole: party.role },
        },
      });

      return { ok: true };
    }),
});
