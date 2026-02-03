import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const signingRouter = createTRPCRouter({
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

      // In a real implementation, this would:
      // 1. Generate the contract document from agreed terms
      // 2. Send to DocuSign/HelloSign API
      // 3. Store the external document ID
      // For now, we create a placeholder signing request

      const initiator = party.dealRoom.parties.find((p) => p.role === "INITIATOR");
      const respondent = party.dealRoom.parties.find((p) => p.role === "RESPONDENT");

      const signingRequest = await ctx.prisma.signingRequest.create({
        data: {
          dealRoomId: input.dealRoomId,
          provider: "type-to-sign",
          status: "PENDING",
          externalId: `sign_${Date.now()}`,
          documentUrl: null,
        },
      });

      // Update deal status to SIGNING
      await ctx.prisma.dealRoom.update({
        where: { id: input.dealRoomId },
        data: { status: "SIGNING" },
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

      // TODO: Send emails to both parties with signing links
      // This would integrate with Resend email service

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
              parties: true,
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

      const now = new Date();
      const updateData: Record<string, Date | string> = {};

      if (input.partyRole === "INITIATOR") {
        if (signingRequest.initiatorSignedAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Party A has already signed",
          });
        }
        updateData.initiatorSignedAt = now;
        updateData.initiatorSignature = input.signature;
      } else {
        if (signingRequest.respondentSignedAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Party B has already signed",
          });
        }
        updateData.respondentSignedAt = now;
        updateData.respondentSignature = input.signature;
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
});
