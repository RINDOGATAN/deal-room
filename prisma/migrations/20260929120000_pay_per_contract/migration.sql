-- CreateEnum
CREATE TYPE "DealPaymentKind" AS ENUM ('CONTRACT', 'CREDIT', 'PLAN');

-- CreateEnum
CREATE TYPE "DealPaymentStatus" AS ENUM ('PAID', 'REVOKED');

-- CreateEnum
CREATE TYPE "AgentCreditReason" AS ENUM ('PURCHASE', 'CONSUME', 'REVERSAL');

-- CreateTable
CREATE TABLE "deal_payments" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT NOT NULL,
    "payerUserId" TEXT,
    "payerApiKeyId" TEXT,
    "customerId" TEXT,
    "kind" "DealPaymentKind" NOT NULL,
    "status" "DealPaymentStatus" NOT NULL DEFAULT 'PAID',
    "dedupeKey" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeSubscriptionId" TEXT,
    "amount" INTEGER,
    "currency" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_credits" (
    "apiKeyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_credits_pkey" PRIMARY KEY ("apiKeyId")
);

-- CreateTable
CREATE TABLE "agent_credit_entries" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "AgentCreditReason" NOT NULL,
    "dealRoomId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_credit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_plans" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deal_payments_dedupeKey_key" ON "deal_payments"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "deal_payments_stripeCheckoutSessionId_key" ON "deal_payments"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "deal_payments_dealRoomId_status_idx" ON "deal_payments"("dealRoomId", "status");

-- CreateIndex
CREATE INDEX "deal_payments_stripePaymentIntentId_idx" ON "deal_payments"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "agent_credits_customerId_idx" ON "agent_credits"("customerId");

-- CreateIndex
CREATE INDEX "agent_credit_entries_apiKeyId_createdAt_idx" ON "agent_credit_entries"("apiKeyId", "createdAt");

-- CreateIndex
CREATE INDEX "agent_credit_entries_stripePaymentIntentId_idx" ON "agent_credit_entries"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_credit_entries_stripeCheckoutSessionId_reason_key" ON "agent_credit_entries"("stripeCheckoutSessionId", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "contract_plans_stripeSubscriptionId_key" ON "contract_plans"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "contract_plans_customerId_idx" ON "contract_plans"("customerId");

-- AddForeignKey
ALTER TABLE "deal_payments" ADD CONSTRAINT "deal_payments_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "deal_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_credit_entries" ADD CONSTRAINT "agent_credit_entries_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "agent_credits"("apiKeyId") ON DELETE CASCADE ON UPDATE CASCADE;

