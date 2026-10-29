-- Anonymous lawyer-review interest counts on finished DPAs. Additive only.
CREATE TABLE "review_interest_events" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "speed" TEXT,
    "locale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_interest_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "review_interest_events_event_idx" ON "review_interest_events"("event");
