-- CreateEnum
CREATE TYPE "RecommendationRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED');

-- CreateTable
CREATE TABLE "lawyer_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "jurisdictions" "GoverningLaw"[],
    "languages" TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lawyer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_requests" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "lawyerId" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "governingLaw" "GoverningLaw" NOT NULL,
    "message" TEXT,
    "status" "RecommendationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "vettingId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lawyer_profiles_userId_key" ON "lawyer_profiles"("userId");

-- AddForeignKey
ALTER TABLE "lawyer_profiles" ADD CONSTRAINT "lawyer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_requests" ADD CONSTRAINT "recommendation_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_requests" ADD CONSTRAINT "recommendation_requests_lawyerId_fkey" FOREIGN KEY ("lawyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_requests" ADD CONSTRAINT "recommendation_requests_vettingId_fkey" FOREIGN KEY ("vettingId") REFERENCES "lawyer_vettings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
