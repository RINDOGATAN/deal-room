import { createTRPCRouter } from "../trpc";
import { dealRouter } from "./deal";
import { selectionsRouter } from "./selections";
import { compromiseRouter } from "./compromise";
import { invitationRouter } from "./invitation";
import { skillsRouter } from "./skills";
import { signingRouter } from "./signing";
import { adminRouter } from "./admin";
import { twoFactorRouter } from "./twoFactor";

export const appRouter = createTRPCRouter({
  deal: dealRouter,
  selections: selectionsRouter,
  compromise: compromiseRouter,
  invitation: invitationRouter,
  skills: skillsRouter,
  signing: signingRouter,
  admin: adminRouter,
  twoFactor: twoFactorRouter,
});

export type AppRouter = typeof appRouter;
