-- Remove credit system (not needed — agents use same subscription model as humans)
DROP TABLE IF EXISTS "credit_transactions";
DROP TABLE IF EXISTS "credit_balances";

-- Remove per-deal pricing from skill packages
ALTER TABLE "skill_packages" DROP COLUMN IF EXISTS "dealPriceCents";

-- Fix revenue share default: 70% to publisher, 30% to platform
ALTER TABLE "skill_packages" ALTER COLUMN "revenueSharePct" SET DEFAULT 70;
