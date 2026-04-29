-- AlterEnum: add CANCELLED for requester-initiated cancellation
ALTER TYPE "RecommendationRequestStatus" ADD VALUE 'CANCELLED';

-- AlterTable: add expiresAt as nullable, backfill, then enforce NOT NULL.
-- Backfill rule: existing rows get createdAt + 30 days. Anything older than
-- that is effectively already stale, which is what we want.
ALTER TABLE "recommendation_requests" ADD COLUMN "expiresAt" TIMESTAMP(3);

UPDATE "recommendation_requests"
   SET "expiresAt" = "createdAt" + INTERVAL '30 days'
 WHERE "expiresAt" IS NULL;

ALTER TABLE "recommendation_requests" ALTER COLUMN "expiresAt" SET NOT NULL;

-- CreateIndex: support future cleanup sweeps and "stale" lookups
CREATE INDEX "recommendation_requests_expiresAt_idx" ON "recommendation_requests"("expiresAt");
