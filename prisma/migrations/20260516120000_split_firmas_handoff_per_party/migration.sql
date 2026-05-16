-- Split the Firmas hand-off columns per-party.
--
-- The first iteration (20260515200000_add_firmas_handoff) used a single
-- "firmasToken" column because we only expected the respondent to sign
-- via Firmas. The new architecture lets either party self-mint a
-- Firmas hand-off — initiator on their phone, respondent on theirs —
-- so each role needs its own token, sent-at stamp, and signed bundle.
--
-- Migration strategy: rename the existing respondent-only columns
-- into per-role mirror columns, then add the initiator-side mirror.
-- Existing rows preserve their state — any in-flight respondent
-- Firmas hand-off carries forward under the new column names.

ALTER TABLE "signing_requests" RENAME COLUMN "firmasToken"  TO "respondentFirmasToken";
ALTER TABLE "signing_requests" RENAME COLUMN "firmasSentAt" TO "respondentFirmasSentAt";
ALTER TABLE "signing_requests" RENAME COLUMN "signedBundle" TO "respondentSignedBundle";

ALTER INDEX "signing_requests_firmasToken_key" RENAME TO "signing_requests_respondentFirmasToken_key";
ALTER INDEX "signing_requests_firmasToken_idx" RENAME TO "signing_requests_respondentFirmasToken_idx";

ALTER TABLE "signing_requests"
  ADD COLUMN "initiatorFirmasToken"   TEXT,
  ADD COLUMN "initiatorFirmasSentAt"  TIMESTAMP(3),
  ADD COLUMN "initiatorSignedBundle"  JSONB;

CREATE UNIQUE INDEX "signing_requests_initiatorFirmasToken_key"
  ON "signing_requests" ("initiatorFirmasToken");

CREATE INDEX "signing_requests_initiatorFirmasToken_idx"
  ON "signing_requests" ("initiatorFirmasToken");
