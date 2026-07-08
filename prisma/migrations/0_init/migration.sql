-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('SAAS', 'SELF_HOSTED');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('TRIAL', 'SUBSCRIPTION', 'PERPETUAL');

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BUSINESS_OWNER', 'LAWYER');

-- CreateEnum
CREATE TYPE "DealMode" AS ENUM ('NEGOTIATION', 'SOLO');

-- CreateEnum
CREATE TYPE "DealRoomStatus" AS ENUM ('DRAFT', 'AWAITING_RESPONSE', 'NEGOTIATING', 'AGREED', 'SIGNING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GoverningLaw" AS ENUM ('CALIFORNIA', 'ENGLAND_WALES', 'SPAIN');

-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('INITIATOR', 'RESPONDENT');

-- CreateEnum
CREATE TYPE "PartyStatus" AS ENUM ('PENDING', 'SUBMITTED', 'REVIEWING', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "ClauseStatus" AS ENUM ('PENDING', 'DIVERGENT', 'SUGGESTED', 'AGREED');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('PENDING_RESPONSE', 'BOTH_RESPONDED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SigningStatus" AS ENUM ('PENDING', 'SENT', 'PARTIALLY_SIGNED', 'COMPLETED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LawyerVettingStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "ClientInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AgentDealStatus" AS ENUM ('PENDING_RESPONDENT', 'NEGOTIATING', 'AGREED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecommendationRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StartupJourneyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "company" TEXT,
    "isLawyer" BOOLEAN NOT NULL DEFAULT false,
    "role" "UserRole",
    "onboardedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supervisors" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supervisors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supervisor_two_factor" (
    "id" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supervisor_two_factor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supervisor_bar_admissions" (
    "id" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "jurisdiction" "GoverningLaw" NOT NULL,
    "barNumber" TEXT NOT NULL,

    CONSTRAINT "supervisor_bar_admissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supervisor_assignments" (
    "id" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "dealRoomId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,

    CONSTRAINT "supervisor_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_two_factor" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_two_factor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "skill_packages" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "packageHash" TEXT NOT NULL,
    "jurisdictions" TEXT[],
    "languages" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stripePriceId" TEXT,
    "priceAmount" INTEGER,
    "priceCurrency" TEXT DEFAULT 'eur',
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "authorId" TEXT,
    "revenueSharePct" INTEGER NOT NULL DEFAULT 70,
    "packageUrl" TEXT,
    "packageSize" INTEGER,

    CONSTRAINT "skill_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL,
    "stripeCustomerId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_entitlements" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "skillPackageId" TEXT NOT NULL,
    "licenseKey" TEXT NOT NULL,
    "licenseType" "LicenseType" NOT NULL,
    "status" "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxActivations" INTEGER NOT NULL DEFAULT 1,
    "jurisdictions" TEXT[],
    "stripeSubscriptionId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_activations" (
    "id" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "machineHash" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_activations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_templates" (
    "id" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "skillPath" TEXT NOT NULL,
    "boilerplate" JSONB,
    "templateFamily" TEXT,
    "nativeJurisdiction" "GoverningLaw",
    "jurisdictions" TEXT[],
    "languages" TEXT[],
    "displayNameLocalized" JSONB,
    "descriptionLocalized" JSONB,
    "category" TEXT,
    "categoryLocalized" JSONB,
    "parameterSchema" JSONB,
    "soloModeSupported" BOOLEAN NOT NULL DEFAULT false,
    "soloModeDefault" BOOLEAN NOT NULL DEFAULT false,
    "soloModeOnly" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "skillPackageId" TEXT,

    CONSTRAINT "contract_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clause_templates" (
    "id" TEXT NOT NULL,
    "contractTemplateId" TEXT NOT NULL,
    "clauseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "plainDescription" TEXT NOT NULL,
    "legalContext" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "localizedContent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clause_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clause_options" (
    "id" TEXT NOT NULL,
    "clauseTemplateId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "plainDescription" TEXT NOT NULL,
    "prosPartyA" TEXT[],
    "consPartyA" TEXT[],
    "prosPartyB" TEXT[],
    "consPartyB" TEXT[],
    "legalText" TEXT NOT NULL,
    "biasPartyA" DOUBLE PRECISION NOT NULL,
    "biasPartyB" DOUBLE PRECISION NOT NULL,
    "jurisdictionConfig" JSONB,
    "localizedContent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clause_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_rooms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contractTemplateId" TEXT NOT NULL,
    "dealMode" "DealMode" NOT NULL DEFAULT 'NEGOTIATION',
    "governingLaw" "GoverningLaw" NOT NULL,
    "contractLanguage" TEXT NOT NULL DEFAULT 'en',
    "parameters" JSONB,
    "soloFillRole" TEXT,
    "status" "DealRoomStatus" NOT NULL DEFAULT 'DRAFT',
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "lawyerVettingId" TEXT,
    "jointCounselSupervisorId" TEXT,
    "jointCounselRequestedAt" TIMESTAMP(3),
    "jointCounselRequestedBy" TEXT,
    "jointCounselAcknowledgedAt" TIMESTAMP(3),
    "jointCounselDeclinedAt" TIMESTAMP(3),
    "journeyId" TEXT,
    "journeyStepKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_room_parties" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT NOT NULL,
    "userId" TEXT,
    "role" "PartyRole" NOT NULL,
    "status" "PartyStatus" NOT NULL DEFAULT 'PENDING',
    "email" TEXT NOT NULL,
    "name" TEXT,
    "company" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "signingDetails" JSONB,
    "attorneyReviewRequested" BOOLEAN NOT NULL DEFAULT false,
    "attorneyReviewRequestedAt" TIMESTAMP(3),
    "attorneySupervisorId" TEXT,
    "attorneyReviewApprovedAt" TIMESTAMP(3),
    "lawyerWarningDismissedAt" TIMESTAMP(3),

    CONSTRAINT "deal_room_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_room_clauses" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT NOT NULL,
    "clauseTemplateId" TEXT NOT NULL,
    "status" "ClauseStatus" NOT NULL DEFAULT 'PENDING',
    "agreedOptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_room_clauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_selections" (
    "id" TEXT NOT NULL,
    "dealRoomClauseId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "flexibility" INTEGER NOT NULL DEFAULT 3,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "party_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compromise_suggestions" (
    "id" TEXT NOT NULL,
    "dealRoomClauseId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "suggestedOptionId" TEXT NOT NULL,
    "satisfactionPartyA" DOUBLE PRECISION NOT NULL,
    "satisfactionPartyB" DOUBLE PRECISION NOT NULL,
    "reasoning" TEXT NOT NULL,
    "partyAAccepted" BOOLEAN,
    "partyBAccepted" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compromise_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negotiation_rounds" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "initiatedBy" "PartyRole" NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'PENDING_RESPONSE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "negotiation_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counter_proposals" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "dealRoomClauseId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "proposedOptionId" TEXT NOT NULL,
    "newPriority" INTEGER,
    "rationale" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "counter_proposals_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "sentById" TEXT NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signing_requests" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "documentUrl" TEXT,
    "status" "SigningStatus" NOT NULL DEFAULT 'PENDING',
    "initiatorSignedAt" TIMESTAMP(3),
    "respondentSignedAt" TIMESTAMP(3),
    "initiatorSignature" TEXT,
    "respondentSignature" TEXT,
    "initiatorSignatureIp" TEXT,
    "initiatorSignatureUa" TEXT,
    "respondentSignatureIp" TEXT,
    "respondentSignatureUa" TEXT,
    "completedAt" TIMESTAMP(3),
    "signedDocumentUrl" TEXT,
    "ceremonyId" TEXT,
    "documentHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "expiryReminderSentAt" TIMESTAMP(3),
    "initiatorFirmasToken" TEXT,
    "initiatorFirmasSentAt" TIMESTAMP(3),
    "initiatorSignedBundle" JSONB,
    "respondentFirmasToken" TEXT,
    "respondentFirmasSentAt" TIMESTAMP(3),
    "respondentSignedBundle" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signing_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lawyer_vettings" (
    "id" TEXT NOT NULL,
    "lawyerId" TEXT NOT NULL,
    "contractTemplateId" TEXT NOT NULL,
    "governingLaw" "GoverningLaw" NOT NULL,
    "contractLanguage" TEXT NOT NULL DEFAULT 'en',
    "status" "LawyerVettingStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lawyer_vettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lawyer_recommendations" (
    "id" TEXT NOT NULL,
    "vettingId" TEXT NOT NULL,
    "clauseTemplateId" TEXT NOT NULL,
    "clauseOptionId" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "lawyer_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_invitations" (
    "id" TEXT NOT NULL,
    "vettingId" TEXT NOT NULL,
    "lawyerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contactName" TEXT,
    "company" TEXT,
    "token" TEXT NOT NULL,
    "status" "ClientInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clause_mappings" (
    "id" TEXT NOT NULL,
    "familyKey" TEXT NOT NULL,
    "sourceClauseId" TEXT NOT NULL,
    "targetClauseId" TEXT NOT NULL,
    "sourceTemplateId" TEXT NOT NULL,
    "targetTemplateId" TEXT NOT NULL,
    "mappingType" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clause_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "scopes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbooks" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "governingLaw" "GoverningLaw" NOT NULL,
    "contractLanguage" TEXT NOT NULL DEFAULT 'en',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbook_entries" (
    "id" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "clauseId" TEXT NOT NULL,
    "preferredOptionId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "flexibility" INTEGER NOT NULL DEFAULT 3,
    "isRedLine" BOOLEAN NOT NULL DEFAULT false,
    "acceptableOptions" TEXT[],
    "notes" TEXT,

    CONSTRAINT "playbook_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_deal_rooms" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT,
    "negotiationToken" TEXT NOT NULL,
    "initiatorCustomerId" TEXT NOT NULL,
    "respondentCustomerId" TEXT,
    "initiatorPlaybookId" TEXT NOT NULL,
    "respondentPlaybookId" TEXT,
    "status" "AgentDealStatus" NOT NULL DEFAULT 'PENDING_RESPONDENT',
    "contractType" TEXT NOT NULL,
    "governingLaw" "GoverningLaw" NOT NULL,
    "contractLanguage" TEXT NOT NULL DEFAULT 'en',
    "dealName" TEXT NOT NULL,
    "initiatorCompany" TEXT NOT NULL,
    "initiatorEmail" TEXT NOT NULL,
    "respondentCompany" TEXT,
    "respondentEmail" TEXT,
    "negotiationLog" JSONB,
    "failureReason" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attestingBarNumber" TEXT,
    "attestingAttorneyName" TEXT,

    CONSTRAINT "agent_deal_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "usedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("id")
);

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
    "title" TEXT,
    "expertTypes" TEXT[],
    "specializations" TEXT[],
    "certifications" TEXT[],
    "countryCode" TEXT,
    "city" TEXT,
    "jurisdictionsCovered" TEXT[],
    "contactUrl" TEXT,
    "acceptingClients" BOOLEAN NOT NULL DEFAULT true,
    "stripeConnectAccountId" TEXT,
    "notifyEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "lawyer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_requests" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT,
    "lawyerId" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "governingLaw" "GoverningLaw",
    "message" TEXT,
    "status" "RecommendationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "vettingId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceApp" TEXT,
    "sourceCustomerId" TEXT,
    "externalRequesterName" TEXT,
    "externalRequesterEmail" TEXT,
    "externalRequesterCompany" TEXT,

    CONSTRAINT "recommendation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "page" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "stripe_webhook_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_counters" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "customerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "responseBody" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("customerId","key")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "startup_journeys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "StartupJourneyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "companyName" TEXT NOT NULL,
    "companyAddress" TEXT,
    "state" TEXT NOT NULL DEFAULT 'DELAWARE',
    "entityType" TEXT NOT NULL DEFAULT 'C_CORP',
    "authorizedShares" INTEGER NOT NULL DEFAULT 10000000,
    "parValue" DECIMAL(12,8) NOT NULL DEFAULT 0.00001,
    "optionPoolPercent" DECIMAL(5,2),
    "stepStatuses" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "startup_journeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey_founders" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "title" TEXT,
    "sharesIssued" INTEGER,
    "equityPercent" DECIMAL(5,2),
    "vestingYears" INTEGER DEFAULT 4,
    "cliffMonths" INTEGER DEFAULT 12,
    "isIncorporator" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journey_founders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_lastLoginAt_idx" ON "users"("lastLoginAt");

-- CreateIndex
CREATE UNIQUE INDEX "supervisors_email_key" ON "supervisors"("email");

-- CreateIndex
CREATE UNIQUE INDEX "supervisor_two_factor_supervisorId_key" ON "supervisor_two_factor"("supervisorId");

-- CreateIndex
CREATE UNIQUE INDEX "supervisor_bar_admissions_supervisorId_jurisdiction_key" ON "supervisor_bar_admissions"("supervisorId", "jurisdiction");

-- CreateIndex
CREATE UNIQUE INDEX "supervisor_assignments_supervisorId_dealRoomId_key" ON "supervisor_assignments"("supervisorId", "dealRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_two_factor_adminId_key" ON "admin_two_factor"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "skill_packages_skillId_key" ON "skill_packages"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "skill_entitlements_licenseKey_key" ON "skill_entitlements"("licenseKey");

-- CreateIndex
CREATE UNIQUE INDEX "skill_entitlements_customerId_skillPackageId_key" ON "skill_entitlements"("customerId", "skillPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_activations_instanceId_key" ON "skill_activations"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "contract_templates_contractType_key" ON "contract_templates"("contractType");

-- CreateIndex
CREATE UNIQUE INDEX "contract_templates_skillPackageId_key" ON "contract_templates"("skillPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "clause_templates_contractTemplateId_clauseId_key" ON "clause_templates"("contractTemplateId", "clauseId");

-- CreateIndex
CREATE UNIQUE INDEX "clause_options_clauseTemplateId_optionId_key" ON "clause_options"("clauseTemplateId", "optionId");

-- CreateIndex
CREATE INDEX "deal_rooms_journeyId_idx" ON "deal_rooms"("journeyId");

-- CreateIndex
CREATE UNIQUE INDEX "deal_room_parties_dealRoomId_role_key" ON "deal_room_parties"("dealRoomId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "deal_room_clauses_dealRoomId_clauseTemplateId_key" ON "deal_room_clauses"("dealRoomId", "clauseTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "party_selections_dealRoomClauseId_partyId_key" ON "party_selections"("dealRoomClauseId", "partyId");

-- CreateIndex
CREATE UNIQUE INDEX "compromise_suggestions_dealRoomClauseId_roundNumber_key" ON "compromise_suggestions"("dealRoomClauseId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "negotiation_rounds_dealRoomId_roundNumber_key" ON "negotiation_rounds"("dealRoomId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "counter_proposals_roundId_dealRoomClauseId_partyId_key" ON "counter_proposals"("roundId", "dealRoomClauseId", "partyId");

-- CreateIndex
CREATE UNIQUE INDEX "parameter_proposals_roundId_parameterId_partyId_key" ON "parameter_proposals"("roundId", "parameterId", "partyId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "signing_requests_dealRoomId_key" ON "signing_requests"("dealRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "signing_requests_initiatorFirmasToken_key" ON "signing_requests"("initiatorFirmasToken");

-- CreateIndex
CREATE UNIQUE INDEX "signing_requests_respondentFirmasToken_key" ON "signing_requests"("respondentFirmasToken");

-- CreateIndex
CREATE INDEX "signing_requests_expiresAt_idx" ON "signing_requests"("expiresAt");

-- CreateIndex
CREATE INDEX "signing_requests_initiatorFirmasToken_idx" ON "signing_requests"("initiatorFirmasToken");

-- CreateIndex
CREATE INDEX "signing_requests_respondentFirmasToken_idx" ON "signing_requests"("respondentFirmasToken");

-- CreateIndex
CREATE INDEX "audit_logs_dealRoomId_idx" ON "audit_logs"("dealRoomId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "lawyer_recommendations_vettingId_clauseTemplateId_key" ON "lawyer_recommendations"("vettingId", "clauseTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "client_invitations_token_key" ON "client_invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "clause_mappings_familyKey_sourceClauseId_targetClauseId_key" ON "clause_mappings"("familyKey", "sourceClauseId", "targetClauseId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "playbooks_customerId_name_key" ON "playbooks"("customerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "playbook_entries_playbookId_clauseId_key" ON "playbook_entries"("playbookId", "clauseId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_deal_rooms_dealRoomId_key" ON "agent_deal_rooms"("dealRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_deal_rooms_negotiationToken_key" ON "agent_deal_rooms"("negotiationToken");

-- CreateIndex
CREATE UNIQUE INDEX "invite_codes_code_key" ON "invite_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "invite_codes_usedByUserId_key" ON "invite_codes"("usedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "lawyer_profiles_userId_key" ON "lawyer_profiles"("userId");

-- CreateIndex
CREATE INDEX "rate_limit_counters_expiresAt_idx" ON "rate_limit_counters"("expiresAt");

-- CreateIndex
CREATE INDEX "idempotency_records_expiresAt_idx" ON "idempotency_records"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "agent_disputes_agentDealRoomId_key" ON "agent_disputes"("agentDealRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_disputes_gavelCaseId_key" ON "agent_disputes"("gavelCaseId");

-- CreateIndex
CREATE INDEX "startup_journeys_userId_idx" ON "startup_journeys"("userId");

-- CreateIndex
CREATE INDEX "journey_founders_journeyId_idx" ON "journey_founders"("journeyId");

-- AddForeignKey
ALTER TABLE "supervisor_two_factor" ADD CONSTRAINT "supervisor_two_factor_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "supervisors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_bar_admissions" ADD CONSTRAINT "supervisor_bar_admissions_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "supervisors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_assignments" ADD CONSTRAINT "supervisor_assignments_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "supervisors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_assignments" ADD CONSTRAINT "supervisor_assignments_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "deal_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_two_factor" ADD CONSTRAINT "admin_two_factor_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "platform_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_entitlements" ADD CONSTRAINT "skill_entitlements_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_entitlements" ADD CONSTRAINT "skill_entitlements_skillPackageId_fkey" FOREIGN KEY ("skillPackageId") REFERENCES "skill_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_activations" ADD CONSTRAINT "skill_activations_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "skill_entitlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_activations" ADD CONSTRAINT "skill_activations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_skillPackageId_fkey" FOREIGN KEY ("skillPackageId") REFERENCES "skill_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_templates" ADD CONSTRAINT "clause_templates_contractTemplateId_fkey" FOREIGN KEY ("contractTemplateId") REFERENCES "contract_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_options" ADD CONSTRAINT "clause_options_clauseTemplateId_fkey" FOREIGN KEY ("clauseTemplateId") REFERENCES "clause_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_rooms" ADD CONSTRAINT "deal_rooms_contractTemplateId_fkey" FOREIGN KEY ("contractTemplateId") REFERENCES "contract_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_rooms" ADD CONSTRAINT "deal_rooms_lawyerVettingId_fkey" FOREIGN KEY ("lawyerVettingId") REFERENCES "lawyer_vettings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_rooms" ADD CONSTRAINT "deal_rooms_jointCounselSupervisorId_fkey" FOREIGN KEY ("jointCounselSupervisorId") REFERENCES "supervisors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_rooms" ADD CONSTRAINT "deal_rooms_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "startup_journeys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_room_parties" ADD CONSTRAINT "deal_room_parties_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "deal_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_room_parties" ADD CONSTRAINT "deal_room_parties_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_room_parties" ADD CONSTRAINT "deal_room_parties_attorneySupervisorId_fkey" FOREIGN KEY ("attorneySupervisorId") REFERENCES "supervisors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_room_clauses" ADD CONSTRAINT "deal_room_clauses_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "deal_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_room_clauses" ADD CONSTRAINT "deal_room_clauses_clauseTemplateId_fkey" FOREIGN KEY ("clauseTemplateId") REFERENCES "clause_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_selections" ADD CONSTRAINT "party_selections_dealRoomClauseId_fkey" FOREIGN KEY ("dealRoomClauseId") REFERENCES "deal_room_clauses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_selections" ADD CONSTRAINT "party_selections_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "deal_room_parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_selections" ADD CONSTRAINT "party_selections_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "clause_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromise_suggestions" ADD CONSTRAINT "compromise_suggestions_dealRoomClauseId_fkey" FOREIGN KEY ("dealRoomClauseId") REFERENCES "deal_room_clauses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromise_suggestions" ADD CONSTRAINT "compromise_suggestions_suggestedOptionId_fkey" FOREIGN KEY ("suggestedOptionId") REFERENCES "clause_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_rounds" ADD CONSTRAINT "negotiation_rounds_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "deal_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_proposals" ADD CONSTRAINT "counter_proposals_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "negotiation_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_proposals" ADD CONSTRAINT "counter_proposals_dealRoomClauseId_fkey" FOREIGN KEY ("dealRoomClauseId") REFERENCES "deal_room_clauses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_proposals" ADD CONSTRAINT "counter_proposals_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "deal_room_parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_proposals" ADD CONSTRAINT "counter_proposals_proposedOptionId_fkey" FOREIGN KEY ("proposedOptionId") REFERENCES "clause_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parameter_proposals" ADD CONSTRAINT "parameter_proposals_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "deal_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parameter_proposals" ADD CONSTRAINT "parameter_proposals_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "negotiation_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parameter_proposals" ADD CONSTRAINT "parameter_proposals_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "deal_room_parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "deal_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signing_requests" ADD CONSTRAINT "signing_requests_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "deal_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "deal_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_vettings" ADD CONSTRAINT "lawyer_vettings_lawyerId_fkey" FOREIGN KEY ("lawyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_vettings" ADD CONSTRAINT "lawyer_vettings_contractTemplateId_fkey" FOREIGN KEY ("contractTemplateId") REFERENCES "contract_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_recommendations" ADD CONSTRAINT "lawyer_recommendations_vettingId_fkey" FOREIGN KEY ("vettingId") REFERENCES "lawyer_vettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_recommendations" ADD CONSTRAINT "lawyer_recommendations_clauseTemplateId_fkey" FOREIGN KEY ("clauseTemplateId") REFERENCES "clause_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_recommendations" ADD CONSTRAINT "lawyer_recommendations_clauseOptionId_fkey" FOREIGN KEY ("clauseOptionId") REFERENCES "clause_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invitations" ADD CONSTRAINT "client_invitations_vettingId_fkey" FOREIGN KEY ("vettingId") REFERENCES "lawyer_vettings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invitations" ADD CONSTRAINT "client_invitations_lawyerId_fkey" FOREIGN KEY ("lawyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_mappings" ADD CONSTRAINT "clause_mappings_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "contract_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clause_mappings" ADD CONSTRAINT "clause_mappings_targetTemplateId_fkey" FOREIGN KEY ("targetTemplateId") REFERENCES "contract_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbooks" ADD CONSTRAINT "playbooks_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbook_entries" ADD CONSTRAINT "playbook_entries_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "playbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_deal_rooms" ADD CONSTRAINT "agent_deal_rooms_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "deal_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_deal_rooms" ADD CONSTRAINT "agent_deal_rooms_initiatorPlaybookId_fkey" FOREIGN KEY ("initiatorPlaybookId") REFERENCES "playbooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_deal_rooms" ADD CONSTRAINT "agent_deal_rooms_respondentPlaybookId_fkey" FOREIGN KEY ("respondentPlaybookId") REFERENCES "playbooks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_usedByUserId_fkey" FOREIGN KEY ("usedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_profiles" ADD CONSTRAINT "lawyer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_requests" ADD CONSTRAINT "recommendation_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_requests" ADD CONSTRAINT "recommendation_requests_lawyerId_fkey" FOREIGN KEY ("lawyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_requests" ADD CONSTRAINT "recommendation_requests_vettingId_fkey" FOREIGN KEY ("vettingId") REFERENCES "lawyer_vettings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_requests" ADD CONSTRAINT "recommendation_requests_sourceCustomerId_fkey" FOREIGN KEY ("sourceCustomerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_usage" ADD CONSTRAINT "negotiation_usage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_usage" ADD CONSTRAINT "negotiation_usage_skillPackageId_fkey" FOREIGN KEY ("skillPackageId") REFERENCES "skill_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_skillPackageId_fkey" FOREIGN KEY ("skillPackageId") REFERENCES "skill_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_disputes" ADD CONSTRAINT "agent_disputes_agentDealRoomId_fkey" FOREIGN KEY ("agentDealRoomId") REFERENCES "agent_deal_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "startup_journeys" ADD CONSTRAINT "startup_journeys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_founders" ADD CONSTRAINT "journey_founders_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "startup_journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

