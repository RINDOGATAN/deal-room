import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const feedbackRouter = createTRPCRouter({
  submit: publicProcedure
    .input(
      z.object({
        message: z.string().min(1).max(2000),
        page: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.feedback.create({
        data: {
          message: input.message,
          page: input.page,
        },
      });
      return { success: true };
    }),
});
