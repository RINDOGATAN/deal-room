-- Migrate expertType (single enum) to expertTypes (String array)
-- 1. Add new column
ALTER TABLE "lawyer_profiles" ADD COLUMN "expertTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 2. Migrate existing data: map old enum values to new array
UPDATE "lawyer_profiles"
SET "expertTypes" = CASE
  WHEN "expertType" = 'BOTH' THEN ARRAY['LEGAL', 'TECHNICAL']
  ELSE ARRAY["expertType"::TEXT]
END;

-- 3. Drop old column and enum
ALTER TABLE "lawyer_profiles" DROP COLUMN "expertType";
DROP TYPE IF EXISTS "ExpertType";
