-- AlterTable: add expiresAt as nullable, backfill, then enforce NOT NULL.
-- Backfill rule: existing rows get createdAt + 14 days (whether already
-- past or still in flight; the timestamp is honest about when the
-- request was initiated and 14 days from then is when it should have
-- finished). New rows always get an explicit value from the app.
ALTER TABLE "signing_requests" ADD COLUMN "expiresAt" TIMESTAMP(3);

UPDATE "signing_requests"
   SET "expiresAt" = "createdAt" + INTERVAL '14 days'
 WHERE "expiresAt" IS NULL;

ALTER TABLE "signing_requests" ALTER COLUMN "expiresAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "signing_requests_expiresAt_idx" ON "signing_requests"("expiresAt");
