-- AlterTable: additional inboxes BCC'd on contact requests for a
-- directory entry, without exposing them in the public listing.
-- Lets one published expert fan out incoming requests to a
-- back-office or partner inbox.

ALTER TABLE "lawyer_profiles"
  ADD COLUMN "notifyEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
