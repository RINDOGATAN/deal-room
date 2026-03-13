-- Phase 1: Usage metering
CREATE TABLE "negotiation_usage" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "skillPackageId" TEXT,
    "agentDealRoomId" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "governingLaw" "GoverningLaw" NOT NULL,
    "outcome" TEXT NOT NULL,
    "billedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "negotiation_usage_pkey" PRIMARY KEY ("id")
);

-- Phase 2: Revenue share fields on SkillPackage
ALTER TABLE "skill_packages" ADD COLUMN "authorId" TEXT;
ALTER TABLE "skill_packages" ADD COLUMN "revenueSharePct" INTEGER NOT NULL DEFAULT 50;

-- Phase 2: Revenue events
CREATE TABLE "revenue_events" (
    "id" TEXT NOT NULL,
    "skillPackageId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "platformAmount" INTEGER NOT NULL,
    "authorAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "stripeTransferId" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "revenue_events_pkey" PRIMARY KEY ("id")
);

-- Phase 2: Attorney attestation on AgentDealRoom
ALTER TABLE "agent_deal_rooms" ADD COLUMN "attestingBarNumber" TEXT;
ALTER TABLE "agent_deal_rooms" ADD COLUMN "attestingAttorneyName" TEXT;

-- Phase 2: Stripe Connect on LawyerProfile
ALTER TABLE "lawyer_profiles" ADD COLUMN "stripeConnectAccountId" TEXT;

-- Phase 3: Agent per-deal pricing on SkillPackage
ALTER TABLE "skill_packages" ADD COLUMN "dealPriceCents" INTEGER;

-- Phase 3: Credit system
CREATE TABLE "credit_balances" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "credit_balances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- Phase 4: Webhooks
CREATE TABLE "webhook_endpoints" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- Phase 6: Agent disputes
CREATE TABLE "agent_disputes" (
    "id" TEXT NOT NULL,
    "agentDealRoomId" TEXT NOT NULL,
    "gavelCaseId" TEXT NOT NULL,
    "escrowAmount" INTEGER,
    "status" TEXT NOT NULL,
    "resolutionData" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_disputes_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "credit_balances_customerId_key" ON "credit_balances"("customerId");
CREATE UNIQUE INDEX "agent_disputes_agentDealRoomId_key" ON "agent_disputes"("agentDealRoomId");
CREATE UNIQUE INDEX "agent_disputes_gavelCaseId_key" ON "agent_disputes"("gavelCaseId");

-- Foreign keys
ALTER TABLE "negotiation_usage" ADD CONSTRAINT "negotiation_usage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "negotiation_usage" ADD CONSTRAINT "negotiation_usage_skillPackageId_fkey" FOREIGN KEY ("skillPackageId") REFERENCES "skill_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_skillPackageId_fkey" FOREIGN KEY ("skillPackageId") REFERENCES "skill_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_disputes" ADD CONSTRAINT "agent_disputes_agentDealRoomId_fkey" FOREIGN KEY ("agentDealRoomId") REFERENCES "agent_deal_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
