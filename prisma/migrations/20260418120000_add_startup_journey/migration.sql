-- Startup Journey: guided launch experience for US startups.
-- Adds StartupJourney + JourneyFounder tables and a nullable journeyId
-- link on deal_rooms so journey-generated deals can be grouped.
-- Fully additive + nullable — existing deals are unaffected.

-- CreateEnum
CREATE TYPE "StartupJourneyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateTable: startup_journeys
CREATE TABLE "startup_journeys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "StartupJourneyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "companyName" TEXT NOT NULL,
    "companyAddress" TEXT,
    "state" TEXT NOT NULL DEFAULT 'DELAWARE',
    "entityType" TEXT NOT NULL DEFAULT 'C_CORP',
    "authorizedShares" INTEGER NOT NULL DEFAULT 10000000,
    "parValue" DECIMAL(12,8) NOT NULL DEFAULT 0.00001,
    "optionPoolPercent" DECIMAL(5,2),
    "stepStatuses" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "startup_journeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable: journey_founders
CREATE TABLE "journey_founders" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "title" TEXT,
    "sharesIssued" INTEGER,
    "equityPercent" DECIMAL(5,2),
    "vestingYears" INTEGER DEFAULT 4,
    "cliffMonths" INTEGER DEFAULT 12,
    "isIncorporator" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journey_founders_pkey" PRIMARY KEY ("id")
);

-- AlterTable: deal_rooms — link a deal to a journey (nullable; existing deals untouched)
ALTER TABLE "deal_rooms"
  ADD COLUMN "journeyId" TEXT,
  ADD COLUMN "journeyStepKey" TEXT;

-- Indexes
CREATE INDEX "startup_journeys_userId_idx" ON "startup_journeys"("userId");
CREATE INDEX "journey_founders_journeyId_idx" ON "journey_founders"("journeyId");
CREATE INDEX "deal_rooms_journeyId_idx" ON "deal_rooms"("journeyId");

-- Foreign keys
ALTER TABLE "startup_journeys"
  ADD CONSTRAINT "startup_journeys_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "journey_founders"
  ADD CONSTRAINT "journey_founders_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "startup_journeys"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deal_rooms"
  ADD CONSTRAINT "deal_rooms_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "startup_journeys"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
