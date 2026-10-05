-- Transactional deal emails (owner decisions of 2026-10-04): one row per
-- email sent, so no reminder goes out twice. Additive only.

-- CreateTable
CREATE TABLE "deal_notifications" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deal_notifications_dedupeKey_key" ON "deal_notifications"("dedupeKey");

-- CreateIndex
CREATE INDEX "deal_notifications_dealRoomId_idx" ON "deal_notifications"("dealRoomId");

-- AddForeignKey
ALTER TABLE "deal_notifications" ADD CONSTRAINT "deal_notifications_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "deal_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
