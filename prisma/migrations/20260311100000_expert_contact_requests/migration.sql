-- Make governingLaw optional for external requests (non-legal experts don't need it)
ALTER TABLE "recommendation_requests" ALTER COLUMN "governingLaw" DROP NOT NULL;

-- Track which external app originated the request
ALTER TABLE "recommendation_requests" ADD COLUMN "sourceApp" TEXT;
ALTER TABLE "recommendation_requests" ADD COLUMN "sourceCustomerId" TEXT;

-- External requester info (when requester is not a Dealroom user)
ALTER TABLE "recommendation_requests" ADD COLUMN "externalRequesterName" TEXT;
ALTER TABLE "recommendation_requests" ADD COLUMN "externalRequesterEmail" TEXT;
ALTER TABLE "recommendation_requests" ADD COLUMN "externalRequesterCompany" TEXT;

-- Make requesterId optional for external requests
ALTER TABLE "recommendation_requests" ALTER COLUMN "requesterId" DROP NOT NULL;

-- Add foreign key for sourceCustomerId
ALTER TABLE "recommendation_requests"
  ADD CONSTRAINT "recommendation_requests_sourceCustomerId_fkey"
  FOREIGN KEY ("sourceCustomerId") REFERENCES "customers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
