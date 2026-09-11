-- Built-in skill refresh: clauses and options a skill no longer contains, but
-- that existing deals still reference, are retired instead of deleted.
ALTER TABLE "clause_templates" ADD COLUMN "retiredAt" TIMESTAMP(3);
ALTER TABLE "clause_options" ADD COLUMN "retiredAt" TIMESTAMP(3);
