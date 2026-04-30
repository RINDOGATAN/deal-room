-- AlterTable: track when the daily cron sent the "expiring soon"
-- reminder so a slightly-off-schedule run doesn't send it twice.
ALTER TABLE "signing_requests" ADD COLUMN "expiryReminderSentAt" TIMESTAMP(3);
