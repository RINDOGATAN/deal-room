-- Credits given without payment (GRANT), with a note saying why. Additive only.
ALTER TYPE "AgentCreditReason" ADD VALUE IF NOT EXISTS 'GRANT';
ALTER TABLE "customer_credit_entries" ADD COLUMN IF NOT EXISTS "note" TEXT;
