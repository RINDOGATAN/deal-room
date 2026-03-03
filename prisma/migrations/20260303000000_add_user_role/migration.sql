-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BUSINESS_OWNER', 'LAWYER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "role" "UserRole",
ADD COLUMN "onboardedAt" TIMESTAMP(3);

-- Backfill: existing lawyers get LAWYER role + onboardedAt
UPDATE "users" SET "role" = 'LAWYER', "onboardedAt" = NOW() WHERE "isLawyer" = true;
