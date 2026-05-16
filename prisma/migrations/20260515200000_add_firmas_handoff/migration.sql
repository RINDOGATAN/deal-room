-- AlterTable: Firmas hand-off columns on SigningRequest. Lets the
-- respondent's signature ceremony route through the Firmas wallet
-- so the signer's identity is cryptographically attested (SD-JWT
-- VC carrying given_name + family_name + id_number_sha256) before
-- the signature is recorded.

ALTER TABLE "signing_requests"
  ADD COLUMN "firmasToken"  TEXT,
  ADD COLUMN "firmasSentAt" TIMESTAMP(3),
  ADD COLUMN "signedBundle" JSONB;

-- Unique constraint so the firmas-callback receiver can look up
-- THIS request by the token alone, and so reuse / replay of a token
-- across two SigningRequest rows is impossible.
CREATE UNIQUE INDEX "signing_requests_firmasToken_key"
  ON "signing_requests" ("firmasToken");

-- Plain index for the dashboard query that lists "sent to Firmas"
-- requests sorted by sentAt — without this it'd scan the table.
CREATE INDEX "signing_requests_firmasToken_idx"
  ON "signing_requests" ("firmasToken");
