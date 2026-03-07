-- CreateTable
CREATE TABLE "parameter_proposals" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "currentValue" TEXT NOT NULL,
    "proposedValue" TEXT NOT NULL,
    "rationale" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parameter_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parameter_proposals_roundId_parameterId_partyId_key" ON "parameter_proposals"("roundId", "parameterId", "partyId");

-- AddForeignKey
ALTER TABLE "parameter_proposals" ADD CONSTRAINT "parameter_proposals_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "deal_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parameter_proposals" ADD CONSTRAINT "parameter_proposals_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "negotiation_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parameter_proposals" ADD CONSTRAINT "parameter_proposals_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "deal_room_parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
