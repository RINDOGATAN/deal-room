-- AlterTable: SOLO mode with an asymmetric-role contract (DPA: Controller vs
-- Processor) records which role the single filling party occupies, so the
-- choice is set once at deal creation and flows consistently into both the
-- direct download and the signing paths. Null for two-party deals and
-- symmetric-role skills.

ALTER TABLE "deal_rooms"
  ADD COLUMN "soloFillRole" TEXT;
