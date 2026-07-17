-- Embedded AI (Phase 2 — Dealroom): install-level AI posture singleton +
-- metadata-only generation audit + nullable AI-annotation columns on
-- compromise_suggestions and signing_requests. Additive only — one new enum,
-- two new tables, five new NULLABLE columns; no existing table, column, row,
-- or migration is touched.

-- CreateEnum
CREATE TYPE "AiPosture" AS ENUM ('off', 'local_gateway', 'cloud_eu', 'cloud_us');

-- AlterTable (nullable, append-only): AI explanation of a deterministic
-- compromise suggestion. The deterministic "reasoning" column is untouched.
ALTER TABLE "compromise_suggestions" ADD COLUMN "aiReasoning" TEXT,
ADD COLUMN "aiReasoningModel" TEXT;

-- AlterTable (nullable, append-only): shared pre-signature risk digest.
ALTER TABLE "signing_requests" ADD COLUMN "aiRiskDigest" TEXT,
ADD COLUMN "aiRiskDigestModel" TEXT,
ADD COLUMN "aiRiskDigestAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ai_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "posture" "AiPosture" NOT NULL DEFAULT 'off',
    "acknowledgedByAdminId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_generations" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT,
    "userId" TEXT,
    "feature" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "model" TEXT,
    "posture" "AiPosture" NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "durationMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_generations_createdAt_idx" ON "ai_generations"("createdAt");

-- CreateIndex
CREATE INDEX "ai_generations_dealRoomId_idx" ON "ai_generations"("dealRoomId");

-- AddForeignKey
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_acknowledgedByAdminId_fkey" FOREIGN KEY ("acknowledgedByAdminId") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "deal_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
