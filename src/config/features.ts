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
  // Disabled while every premium skill is free — a /marketplace listing of
  // priced skills contradicts the "everything's free right now" banner. Flip
  // back to `true` to restore the footer link + the page itself.
  marketplace: false,
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
  /**
   * Promotional unlock: all premium skills available without an entitlement.
   * Drives usage during a launch / awareness window.
   *
   * Reads BOTH `FREE_TRIAL_ALL_SKILLS` (server-only) and
   * `NEXT_PUBLIC_FREE_TRIAL_ALL_SKILLS` (server + client). The public-prefixed
   * variant is required for the `<PromoBanner>` to render — Next.js only
   * inlines `NEXT_PUBLIC_*` env vars into client bundles. Set both to `true`
   * on Vercel for the banner and server gating to be consistent.
   *
   * Stripe checkout still functions throughout, so customers who subscribe
   * early keep their entitlements when the promo ends.
   */
  allSkillsFree:
    process.env.NEXT_PUBLIC_FREE_TRIAL_ALL_SKILLS === "true" ||
    process.env.FREE_TRIAL_ALL_SKILLS === "true",
} as const;
