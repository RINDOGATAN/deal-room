import { brand } from "./brand";

// All features that used to be gated to brand.id === "todo" are now
// always on — the second brand was retired on 2026-05-02. The flag
// shape is kept (rather than inlining `true`) so call-site reads
// like `features.marketplace` stay self-documenting.
export const features = {
  stripeEnabled: !!process.env.STRIPE_SECRET_KEY,
  selfServiceUpgrade: !!process.env.STRIPE_SECRET_KEY,
  inviteCodeAuth: brand.auth.mode === "invite-code",
  magicLinkAuth: brand.auth.mode === "magic-link",
  lawyerInvolvement: true,
  billing: !!process.env.STRIPE_SECRET_KEY,
  marketplace: true,
  clientInvitations: true,
  agentApi: true,
  expertsApi: true,
  publicDocs: true,
  /** Cloud Intelligence API — data-driven biases, quality scoring, conflict detection */
  cloudIntelligence: !!process.env.DEALROOM_CLOUD_API_KEY,
  /** Document Certification — cryptographic hashing, RFC 3161 timestamps, audit certificates */
  certification: !!process.env.DEALROOM_CLOUD_API_KEY,
  /** Analytics Dashboard — negotiation benchmarks, counterparty intelligence */
  analytics: !!process.env.DEALROOM_CLOUD_API_KEY,
  /** Startup Quick Start — guided US Delaware C-Corp launch journey */
  startupJourney: true,
} as const;
