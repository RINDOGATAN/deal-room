-- CreateEnum
CREATE TYPE "ExpertType" AS ENUM ('LEGAL', 'TECHNICAL', 'BOTH');

-- AlterTable
ALTER TABLE "lawyer_profiles"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "expertType" "ExpertType" NOT NULL DEFAULT 'LEGAL',
  ADD COLUMN "specializations" TEXT[] DEFAULT '{}',
  ADD COLUMN "certifications" TEXT[] DEFAULT '{}',
  ADD COLUMN "countryCode" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "jurisdictionsCovered" TEXT[] DEFAULT '{}',
  ADD COLUMN "contactUrl" TEXT,
  ADD COLUMN "acceptingClients" BOOLEAN NOT NULL DEFAULT true;
