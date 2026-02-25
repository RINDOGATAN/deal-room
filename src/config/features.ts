import { brand } from "./brand";

export const features = {
  stripeEnabled: !!process.env.STRIPE_SECRET_KEY,
  selfServiceUpgrade: !!process.env.STRIPE_SECRET_KEY,
  inviteCodeAuth: brand.auth.mode === "invite-code",
  magicLinkAuth: brand.auth.mode === "magic-link",
  lawyerInvolvement: brand.id === "todo",
  billing: !!process.env.STRIPE_SECRET_KEY,
  marketplace: brand.id === "todo",
  clientInvitations: brand.id === "todo",
  agentApi: brand.id === "todo",
  publicDocs: brand.id === "todo",
} as const;
