-- Storefront deep-link slug for premium skills (self-host discoverability →
-- todo.law/legalskills/{marketplaceSlug}). Nullable; only self-host stubs and
-- catalogued premium packages set it.
ALTER TABLE "skill_packages" ADD COLUMN "marketplaceSlug" TEXT;
