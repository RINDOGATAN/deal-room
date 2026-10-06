-- One-call agent generation: the other side's details on a SOLO deal.
ALTER TABLE "deal_rooms" ADD COLUMN "soloCounterparty" JSONB;
