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
  expertsApi: brand.id === "todo",
  publicDocs: brand.id === "todo",
  /** Cloud Intelligence API — data-driven biases, quality scoring, conflict detection */
  cloudIntelligence: !!process.env.DEALROOM_CLOUD_API_KEY,
  /** Document Certification — cryptographic hashing, RFC 3161 timestamps, audit certificates */
  certification: !!process.env.DEALROOM_CLOUD_API_KEY,
  /** Analytics Dashboard — negotiation benchmarks, counterparty intelligence */
  analytics: !!process.env.DEALROOM_CLOUD_API_KEY,
} as const;
