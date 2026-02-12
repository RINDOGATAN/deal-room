import { createTRPCRouter } from "../trpc";
import { dealRouter } from "./deal";
import { selectionsRouter } from "./selections";
import { compromiseRouter } from "./compromise";
import { invitationRouter } from "./invitation";
import { skillsRouter } from "./skills";
import { signingRouter } from "./signing";
import { adminRouter } from "./admin";
import { twoFactorRouter } from "./twoFactor";
import { skillManagerRouter } from "./skillManager";
import { attorneyReviewRouter } from "./attorneyReview";
import { supervisorRouter } from "./supervisor";
import { supervisorTwoFactorRouter } from "./supervisorTwoFactor";
import { platformAdminRouter } from "./platformAdmin";
import { platformAdminTwoFactorRouter } from "./platformAdminTwoFactor";
import { lawyerRouter } from "./lawyer";
import { billingRouter } from "./billing";

export const appRouter = createTRPCRouter({
  deal: dealRouter,
  selections: selectionsRouter,
  compromise: compromiseRouter,
  invitation: invitationRouter,
  skills: skillsRouter,
  signing: signingRouter,
  admin: adminRouter, // Legacy admin router (for backward compatibility)
  twoFactor: twoFactorRouter,
  skillManager: skillManagerRouter,
  attorneyReview: attorneyReviewRouter,
  // New two-level admin system
  supervisor: supervisorRouter,
  supervisorTwoFactor: supervisorTwoFactorRouter,
  platformAdmin: platformAdminRouter,
  platformAdminTwoFactor: platformAdminTwoFactorRouter,
  lawyer: lawyerRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;
