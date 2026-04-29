import { createTRPCRouter } from "../trpc";
import { dealRouter } from "./deal";
import { selectionsRouter } from "./selections";
import { compromiseRouter } from "./compromise";
import { invitationRouter } from "./invitation";
import { skillsRouter } from "./skills";
import { signingRouter } from "./signing";
import { skillManagerRouter } from "./skillManager";
import { attorneyReviewRouter } from "./attorneyReview";
import { supervisorRouter } from "./supervisor";
import { supervisorTwoFactorRouter } from "./supervisorTwoFactor";
import { platformAdminRouter } from "./platformAdmin";
import { platformAdminTwoFactorRouter } from "./platformAdminTwoFactor";
import { lawyerRouter } from "./lawyer";
import { billingRouter } from "./billing";
import { jointCounselRouter } from "./jointCounsel";
import { feedbackRouter } from "./feedback";
import { analyticsRouter } from "./analytics";
import { journeyRouter } from "./journey";

export const appRouter = createTRPCRouter({
  deal: dealRouter,
  selections: selectionsRouter,
  compromise: compromiseRouter,
  invitation: invitationRouter,
  skills: skillsRouter,
  signing: signingRouter,
  skillManager: skillManagerRouter,
  attorneyReview: attorneyReviewRouter,
  // Two-level admin system: supervisors review specific deals,
  // platform admins manage the platform globally. Each has its own
  // session cookie + 2FA path.
  supervisor: supervisorRouter,
  supervisorTwoFactor: supervisorTwoFactorRouter,
  platformAdmin: platformAdminRouter,
  platformAdminTwoFactor: platformAdminTwoFactorRouter,
  lawyer: lawyerRouter,
  billing: billingRouter,
  jointCounsel: jointCounselRouter,
  feedback: feedbackRouter,
  analytics: analyticsRouter,
  journey: journeyRouter,
});

export type AppRouter = typeof appRouter;
