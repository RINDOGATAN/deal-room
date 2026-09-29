-- Pay per contract, round 2 (2026-09-29): agent credits belong to the
-- customer, not to one API key. Additive only: the round-1 per-key tables
-- (agent_credits, agent_credit_entries) and the discarded plan table
-- (contract_plans) stay in place, unused.

-- CreateTable
CREATE TABLE "customer_credits" (
    "customerId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_credits_pkey" PRIMARY KEY ("customerId")
);

-- CreateTable
CREATE TABLE "customer_credit_entries" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "delta" INTEGER NOT NULL,
    "reason" "AgentCreditReason" NOT NULL,
    "dealRoomId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_credit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_credit_entries_customerId_createdAt_idx" ON "customer_credit_entries"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "customer_credit_entries_stripePaymentIntentId_idx" ON "customer_credit_entries"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_credit_entries_stripeCheckoutSessionId_reason_key" ON "customer_credit_entries"("stripeCheckoutSessionId", "reason");

-- AddForeignKey
ALTER TABLE "customer_credit_entries" ADD CONSTRAINT "customer_credit_entries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_credits"("customerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry any per-key credit into its customer's balance (none exists on a
-- deployment that never ran round 1; on one that did, nothing is lost).
INSERT INTO "customer_credits" ("customerId", "balance", "createdAt", "updatedAt")
SELECT "customerId", SUM("balance"), MIN("createdAt"), CURRENT_TIMESTAMP
FROM "agent_credits"
GROUP BY "customerId";

INSERT INTO "customer_credit_entries"
    ("id", "customerId", "apiKeyId", "delta", "reason", "dealRoomId",
     "stripeCheckoutSessionId", "stripePaymentIntentId", "createdAt")
SELECT e."id", c."customerId", e."apiKeyId", e."delta", e."reason", e."dealRoomId",
       e."stripeCheckoutSessionId", e."stripePaymentIntentId", e."createdAt"
FROM "agent_credit_entries" e
JOIN "agent_credits" c ON c."apiKeyId" = e."apiKeyId";
