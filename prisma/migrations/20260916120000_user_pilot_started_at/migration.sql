-- Hosted pilot: start of each account's 90-day edit window.
ALTER TABLE "users" ADD COLUMN "pilotStartedAt" TIMESTAMP(3);
