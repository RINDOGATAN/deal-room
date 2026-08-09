-- DropForeignKey
ALTER TABLE "agent_deal_rooms" DROP CONSTRAINT "agent_deal_rooms_initiatorPlaybookId_fkey";

-- AlterTable
ALTER TABLE "agent_deal_rooms" ALTER COLUMN "initiatorPlaybookId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "agent_deal_rooms" ADD CONSTRAINT "agent_deal_rooms_initiatorPlaybookId_fkey" FOREIGN KEY ("initiatorPlaybookId") REFERENCES "playbooks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
