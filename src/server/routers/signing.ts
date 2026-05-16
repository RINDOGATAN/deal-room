import { z } from "zod";
import { headers } from "next/headers";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { sendSigningInitiatedEmail, sendCounterpartySignedEmail } from "@/lib/email";
import { certificationService } from "@/lib/certification-client";
import { generateContractData } from "@/server/services/document/generator";

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

      const initiator = party.dealRoom.parties.find((p) => p.role === "INITIATOR");
      const respondent = party.dealRoom.parties.find((p) => p.role === "RESPONDENT");

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
        console.error("Certification ceremony failed (continuing uncertified):", error);
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
            console.error("Failed to send signing initiated email:", error);
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
          console.error("Certification signature recording failed:", error);
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
            console.error("Failed to send counterparty signed email:", error);
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
   * Hand the signing ceremony off to the Firmas wallet so the
   * respondent's identity is cryptographically attested (SD-JWT VC
   * carrying given_name + family_name + id_number_sha256) before the
   * signature is recorded.
   *
   * Returns a `firmas.io/sign/<token>` URL the caller can paste into
   * the respondent's email or copy to their clipboard. The Firmas
   * callback receiver at `/api/signing/firmas-callback` looks up the
   * SigningRequest by token, verifies the signed bundle Firmas posts
   * back, marks `respondentSignedAt`, and transitions the DealRoom
   * to COMPLETED when both parties have signed.
   *
   * Idempotent: calling twice on the same SigningRequest returns the
   * same token (we don't churn link URLs if the user re-presses the
   * button) but bumps `firmasSentAt` so the dashboard shows the
   * most recent send.
   */
  sendToFirmas: protectedProcedure
    .input(z.object({ dealRoomId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Auth: caller must be a party on the deal. We only let the
      // INITIATOR drive this (mirrors the rest of signing.* which
      // currently treats signing as initiator-driven), so a hostile
      // respondent can't fork the hand-off mid-flight.
      const party = await ctx.prisma.dealRoomParty.findFirst({
        where: {
          dealRoomId: input.dealRoomId,
          userId: ctx.session.user.id,
          role: "INITIATOR",
        },
      });
      if (!party) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the deal initiator can hand off signing to Firmas",
        });
      }

      const signingRequest = await ctx.prisma.signingRequest.findUnique({
        where: { dealRoomId: input.dealRoomId },
      });
      if (!signingRequest) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Initiate signing before sending to Firmas",
        });
      }
      if (signingRequest.status === "COMPLETED" || signingRequest.status === "DECLINED" || signingRequest.status === "EXPIRED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot send a ${signingRequest.status.toLowerCase()} signing request to Firmas`,
        });
      }

      // Mint token once, reuse on subsequent calls. UUID v4 — opaque,
      // unguessable, indexed. We don't reuse Prisma's @default(cuid())
      // because the column is nullable: most SigningRequests will
      // never get a Firmas token, and we'd rather allocate it on
      // demand than litter the table with unused IDs.
      const token = signingRequest.firmasToken ?? crypto.randomUUID();

      const updated = await ctx.prisma.signingRequest.update({
        where: { id: signingRequest.id },
        data: {
          firmasToken: token,
          firmasSentAt: new Date(),
          status: signingRequest.status === "PENDING" ? "SENT" : signingRequest.status,
        },
      });

      // Build the URL. The dealKey fragment is the AES-256-GCM key
      // that Firmas uses to decrypt the contract bundle it fetches.
      // For this first iteration we transmit the bundle over a
      // protected GET endpoint and the fragment is left empty —
      // future hardening can add fragment-based E2E encryption to
      // mirror Firmas's own invite-link pattern.
      const firmasBase = process.env.FIRMAS_BASE_URL ?? "https://www.firmas.io";
      const url = `${firmasBase}/sign/${token}`;

      return {
        token: updated.firmasToken!,
        sentAt: updated.firmasSentAt,
        url,
      };
    }),
});
