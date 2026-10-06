-- Agent API deal deletion (2026-10-06): the billing record of a payment whose
-- deal was deleted. Same columns as deal_payments; no party names, no
-- contract content.

-- CreateTable
CREATE TABLE "deleted_deal_payments" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT NOT NULL,
    "agentDealRoomId" TEXT,
    "payerUserId" TEXT,
    "payerApiKeyId" TEXT,
    "customerId" TEXT,
    "kind" "DealPaymentKind" NOT NULL,
    "status" "DealPaymentStatus" NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeSubscriptionId" TEXT,
    "amount" INTEGER,
    "currency" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deleted_deal_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deleted_deal_payments_dealRoomId_idx" ON "deleted_deal_payments"("dealRoomId");

-- CreateIndex
CREATE INDEX "deleted_deal_payments_customerId_idx" ON "deleted_deal_payments"("customerId");

-- CreateIndex
CREATE INDEX "deleted_deal_payments_stripeCheckoutSessionId_idx" ON "deleted_deal_payments"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "deleted_deal_payments_stripePaymentIntentId_idx" ON "deleted_deal_payments"("stripePaymentIntentId");
