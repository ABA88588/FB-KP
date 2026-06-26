-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'OPERATOR', 'ANALYST', 'VIEWER');

-- CreateEnum
CREATE TYPE "ConnectionMode" AS ENUM ('LIVE', 'DEMO');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('HEALTHY', 'EXPIRING', 'EXPIRED', 'REVOKED', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "DataSourceMode" AS ENUM ('LIVE', 'DEMO');

-- CreateEnum
CREATE TYPE "EntityLevel" AS ENUM ('ACCOUNT', 'CAMPAIGN', 'ADSET', 'AD');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED', 'UNKNOWN_OUTCOME');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('DRAFT', 'PUBLISHING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "MutationStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'UNKNOWN_OUTCOME', 'RECONCILING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('QUEUED', 'STARTED', 'META_RUNNING', 'META_COMPLETED', 'INGESTING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'PARTIAL', 'DENIED', 'FAILED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('META_USER', 'META_SYSTEM_USER', 'META_PAGE');

-- CreateEnum
CREATE TYPE "CursorScope" AS ENUM ('AD_ACCOUNTS', 'CAMPAIGNS', 'ADSETS', 'ADS', 'CREATIVES', 'INSIGHTS', 'PAGES', 'INSTAGRAM_ACCOUNTS', 'PIXELS', 'CUSTOM_AUDIENCES', 'REPORT');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAccount" (
    "id" UUID NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accessTokenCiphertext" TEXT,
    "refreshTokenCiphertext" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "AuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "valueHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthState" (
    "id" UUID NOT NULL,
    "stateHash" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "returnTo" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaConnection" (
    "id" UUID NOT NULL,
    "mode" "ConnectionMode" NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'HEALTHY',
    "metaUserId" TEXT,
    "metaBusinessIds" JSONB,
    "scopes" TEXT[],
    "tokenCiphertext" TEXT,
    "tokenIv" TEXT,
    "tokenAuthTag" TEXT,
    "tokenKeyVersion" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastValidatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,

    CONSTRAINT "MetaConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdAccount" (
    "id" UUID NOT NULL,
    "metaId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "disableReason" TEXT,
    "currency" TEXT NOT NULL,
    "timezoneName" TEXT NOT NULL,
    "timezoneOffsetHoursUtc" DECIMAL(6,2),
    "amountSpentMinor" BIGINT,
    "balanceMinor" BIGINT,
    "spendCapMinor" BIGINT,
    "businessMetaId" TEXT,
    "dataSource" "DataSourceMode" NOT NULL,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "isReadOnly" BOOLEAN NOT NULL DEFAULT true,
    "primaryConversionAction" TEXT,
    "lastEntitySyncAt" TIMESTAMP(3),
    "lastInsightsSyncAt" TIMESTAMP(3),
    "sourceLastSeenAt" TIMESTAMP(3),
    "isDeletedAtSource" BOOLEAN NOT NULL DEFAULT false,
    "missingFullSyncCount" INTEGER NOT NULL DEFAULT 0,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,
    "connectionId" UUID NOT NULL,

    CONSTRAINT "AdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncryptedToken" (
    "id" UUID NOT NULL,
    "type" "TokenType" NOT NULL,
    "subjectMetaId" TEXT NOT NULL,
    "scopes" TEXT[],
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "keyVersion" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,
    "connectionId" UUID NOT NULL,

    CONSTRAINT "EncryptedToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cursor" (
    "id" UUID NOT NULL,
    "scope" "CursorScope" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "after" TEXT,
    "since" TIMESTAMP(3),
    "until" TIMESTAMP(3),
    "checkpointJson" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,
    "connectionId" UUID,
    "adAccountId" UUID,

    CONSTRAINT "Cursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" UUID NOT NULL,
    "metaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "buyingType" TEXT,
    "configuredStatus" TEXT NOT NULL,
    "effectiveStatus" TEXT NOT NULL,
    "dailyBudgetMinor" BIGINT,
    "lifetimeBudgetMinor" BIGINT,
    "budgetRemainingMinor" BIGINT,
    "specialAdCategories" TEXT[],
    "startTime" TIMESTAMP(3),
    "stopTime" TIMESTAMP(3),
    "sourceCreatedAt" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3),
    "sourceLastSeenAt" TIMESTAMP(3),
    "isDeletedAtSource" BOOLEAN NOT NULL DEFAULT false,
    "missingFullSyncCount" INTEGER NOT NULL DEFAULT 0,
    "issuesJson" JSONB,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,
    "adAccountId" UUID NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdSet" (
    "id" UUID NOT NULL,
    "metaId" TEXT NOT NULL,
    "campaignMetaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "configuredStatus" TEXT NOT NULL,
    "effectiveStatus" TEXT NOT NULL,
    "optimizationGoal" TEXT,
    "billingEvent" TEXT,
    "bidStrategy" TEXT,
    "bidAmountMinor" BIGINT,
    "dailyBudgetMinor" BIGINT,
    "lifetimeBudgetMinor" BIGINT,
    "budgetRemainingMinor" BIGINT,
    "destinationType" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "targetingJson" JSONB,
    "promotedObjectJson" JSONB,
    "attributionSpecJson" JSONB,
    "issuesJson" JSONB,
    "sourceCreatedAt" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3),
    "sourceLastSeenAt" TIMESTAMP(3),
    "isDeletedAtSource" BOOLEAN NOT NULL DEFAULT false,
    "missingFullSyncCount" INTEGER NOT NULL DEFAULT 0,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,
    "adAccountId" UUID NOT NULL,
    "campaignId" UUID,

    CONSTRAINT "AdSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" UUID NOT NULL,
    "metaId" TEXT NOT NULL,
    "campaignMetaId" TEXT NOT NULL,
    "adSetMetaId" TEXT NOT NULL,
    "creativeMetaId" TEXT,
    "name" TEXT NOT NULL,
    "configuredStatus" TEXT NOT NULL,
    "effectiveStatus" TEXT NOT NULL,
    "trackingSpecsJson" JSONB,
    "conversionSpecsJson" JSONB,
    "issuesJson" JSONB,
    "sourceCreatedAt" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3),
    "sourceLastSeenAt" TIMESTAMP(3),
    "isDeletedAtSource" BOOLEAN NOT NULL DEFAULT false,
    "missingFullSyncCount" INTEGER NOT NULL DEFAULT 0,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,
    "adAccountId" UUID NOT NULL,
    "campaignId" UUID,
    "adSetId" UUID,
    "creativeId" UUID,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creative" (
    "id" UUID NOT NULL,
    "metaId" TEXT NOT NULL,
    "name" TEXT,
    "title" TEXT,
    "body" TEXT,
    "imageHash" TEXT,
    "imageUrl" TEXT,
    "thumbnailUrl" TEXT,
    "callToActionType" TEXT,
    "effectiveObjectStoryId" TEXT,
    "status" TEXT,
    "urlTags" TEXT,
    "objectStorySpecJson" JSONB,
    "assetFeedSpecJson" JSONB,
    "sourceLastSeenAt" TIMESTAMP(3),
    "isDeletedAtSource" BOOLEAN NOT NULL DEFAULT false,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,
    "adAccountId" UUID NOT NULL,

    CONSTRAINT "Creative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" UUID NOT NULL,
    "metaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "accessTokenRef" TEXT,
    "tasks" TEXT[],
    "rawJson" JSONB,
    "sourceLastSeenAt" TIMESTAMP(3),
    "isDeletedAtSource" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,
    "adAccountId" UUID,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramAccount" (
    "id" UUID NOT NULL,
    "metaId" TEXT NOT NULL,
    "username" TEXT,
    "name" TEXT,
    "rawJson" JSONB,
    "sourceLastSeenAt" TIMESTAMP(3),
    "isDeletedAtSource" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,
    "adAccountId" UUID,

    CONSTRAINT "InstagramAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pixel" (
    "id" UUID NOT NULL,
    "metaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "rawJson" JSONB,
    "sourceLastSeenAt" TIMESTAMP(3),
    "isDeletedAtSource" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,
    "adAccountId" UUID,

    CONSTRAINT "Pixel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomAudience" (
    "id" UUID NOT NULL,
    "metaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subtype" TEXT,
    "approximateCount" BIGINT,
    "deliveryStatusJson" JSONB,
    "operationStatusJson" JSONB,
    "rawJson" JSONB,
    "sourceLastSeenAt" TIMESTAMP(3),
    "isDeletedAtSource" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,
    "adAccountId" UUID,

    CONSTRAINT "CustomAudience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" UUID NOT NULL,
    "level" "EntityLevel" NOT NULL,
    "entityMetaId" TEXT NOT NULL,
    "dateStart" DATE NOT NULL,
    "dateStop" DATE NOT NULL,
    "timeIncrement" TEXT NOT NULL,
    "breakdownHash" TEXT NOT NULL,
    "breakdownJson" JSONB NOT NULL,
    "attributionHash" TEXT NOT NULL,
    "attributionJson" JSONB,
    "currency" TEXT NOT NULL,
    "spend" DECIMAL(30,10),
    "impressions" BIGINT,
    "reach" BIGINT,
    "frequency" DECIMAL(20,10),
    "clicks" BIGINT,
    "uniqueClicks" BIGINT,
    "linkClicks" BIGINT,
    "outboundClicks" BIGINT,
    "conversions" DECIMAL(30,10),
    "conversionValue" DECIMAL(30,10),
    "ctr" DECIMAL(20,10),
    "cpc" DECIMAL(30,10),
    "cpm" DECIMAL(30,10),
    "cpa" DECIMAL(30,10),
    "roas" DECIMAL(30,10),
    "actionsJson" JSONB,
    "actionValuesJson" JSONB,
    "costPerActionTypeJson" JSONB,
    "purchaseRoasJson" JSONB,
    "rawJson" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,
    "adAccountId" UUID NOT NULL,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "level" "EntityLevel" NOT NULL,
    "configJson" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,
    "adAccountId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT,
    "status" "DraftStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "payloadJson" JSONB NOT NULL,
    "validationJson" JSONB,
    "lastSavedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,
    "adAccountId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" UUID NOT NULL,
    "queueName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "requestId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "checkpointJson" JSONB,
    "resultSummaryJson" JSONB,
    "errorJson" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,
    "connectionId" UUID,
    "adAccountId" UUID,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "status" "MutationStatus" NOT NULL DEFAULT 'PENDING',
    "requestId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "resultJson" JSONB,
    "errorJson" JSONB,
    "metaObjectIdsJson" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "adAccountId" UUID NOT NULL,
    "actorUserId" UUID,
    "draftId" UUID,

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportPreset" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "queryJson" JSONB NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,
    "adAccountId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "ReportPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportRun" (
    "id" UUID NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'QUEUED',
    "requestId" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "queryJson" JSONB NOT NULL,
    "metaReportRunId" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "rowCount" INTEGER,
    "resultSummaryJson" JSONB,
    "errorJson" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "adAccountId" UUID NOT NULL,
    "presetId" UUID,

    CONSTRAINT "ReportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportFile" (
    "id" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" BIGINT,
    "checksum" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "downloadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" UUID NOT NULL,
    "reportRunId" UUID,

    CONSTRAINT "ExportFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "metaIdMasked" TEXT,
    "outcome" "AuditOutcome" NOT NULL,
    "requestId" TEXT NOT NULL,
    "jobId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "summaryJson" JSONB,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" UUID NOT NULL,
    "actorUserId" UUID,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiRequestLog" (
    "id" UUID NOT NULL,
    "service" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "metaErrorCode" INTEGER,
    "metaErrorSubcode" INTEGER,
    "fbtraceId" TEXT,
    "rateLimitJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" UUID NOT NULL,

    CONSTRAINT "ApiRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthAccount_userId_idx" ON "AuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccount_providerId_providerAccountId_key" ON "AuthAccount"("providerId", "providerAccountId");

-- CreateIndex
CREATE INDEX "Verification_expiresAt_idx" ON "Verification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Verification_identifier_valueHash_key" ON "Verification"("identifier", "valueHash");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_organizationId_userId_key" ON "Membership"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthState_stateHash_key" ON "OAuthState"("stateHash");

-- CreateIndex
CREATE INDEX "OAuthState_organizationId_userId_idx" ON "OAuthState"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "OAuthState_expiresAt_idx" ON "OAuthState"("expiresAt");

-- CreateIndex
CREATE INDEX "MetaConnection_organizationId_status_idx" ON "MetaConnection"("organizationId", "status");

-- CreateIndex
CREATE INDEX "MetaConnection_tokenExpiresAt_idx" ON "MetaConnection"("tokenExpiresAt");

-- CreateIndex
CREATE INDEX "AdAccount_organizationId_isSelected_idx" ON "AdAccount"("organizationId", "isSelected");

-- CreateIndex
CREATE INDEX "AdAccount_connectionId_idx" ON "AdAccount"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "AdAccount_organizationId_metaId_key" ON "AdAccount"("organizationId", "metaId");

-- CreateIndex
CREATE INDEX "EncryptedToken_organizationId_expiresAt_idx" ON "EncryptedToken"("organizationId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EncryptedToken_organizationId_connectionId_type_subjectMeta_key" ON "EncryptedToken"("organizationId", "connectionId", "type", "subjectMetaId");

-- CreateIndex
CREATE INDEX "Cursor_organizationId_scope_updatedAt_idx" ON "Cursor"("organizationId", "scope", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cursor_organizationId_scope_objectKey_key" ON "Cursor"("organizationId", "scope", "objectKey");

-- CreateIndex
CREATE INDEX "Campaign_adAccountId_configuredStatus_idx" ON "Campaign"("adAccountId", "configuredStatus");

-- CreateIndex
CREATE INDEX "Campaign_adAccountId_effectiveStatus_idx" ON "Campaign"("adAccountId", "effectiveStatus");

-- CreateIndex
CREATE INDEX "Campaign_adAccountId_name_idx" ON "Campaign"("adAccountId", "name");

-- CreateIndex
CREATE INDEX "Campaign_sourceUpdatedAt_idx" ON "Campaign"("sourceUpdatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_organizationId_adAccountId_metaId_key" ON "Campaign"("organizationId", "adAccountId", "metaId");

-- CreateIndex
CREATE INDEX "AdSet_adAccountId_campaignMetaId_idx" ON "AdSet"("adAccountId", "campaignMetaId");

-- CreateIndex
CREATE INDEX "AdSet_adAccountId_configuredStatus_idx" ON "AdSet"("adAccountId", "configuredStatus");

-- CreateIndex
CREATE INDEX "AdSet_adAccountId_effectiveStatus_idx" ON "AdSet"("adAccountId", "effectiveStatus");

-- CreateIndex
CREATE INDEX "AdSet_adAccountId_name_idx" ON "AdSet"("adAccountId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AdSet_organizationId_adAccountId_metaId_key" ON "AdSet"("organizationId", "adAccountId", "metaId");

-- CreateIndex
CREATE INDEX "Ad_adAccountId_campaignMetaId_idx" ON "Ad"("adAccountId", "campaignMetaId");

-- CreateIndex
CREATE INDEX "Ad_adAccountId_adSetMetaId_idx" ON "Ad"("adAccountId", "adSetMetaId");

-- CreateIndex
CREATE INDEX "Ad_adAccountId_configuredStatus_idx" ON "Ad"("adAccountId", "configuredStatus");

-- CreateIndex
CREATE INDEX "Ad_adAccountId_effectiveStatus_idx" ON "Ad"("adAccountId", "effectiveStatus");

-- CreateIndex
CREATE INDEX "Ad_adAccountId_name_idx" ON "Ad"("adAccountId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Ad_organizationId_adAccountId_metaId_key" ON "Ad"("organizationId", "adAccountId", "metaId");

-- CreateIndex
CREATE INDEX "Creative_adAccountId_name_idx" ON "Creative"("adAccountId", "name");

-- CreateIndex
CREATE INDEX "Creative_adAccountId_imageHash_idx" ON "Creative"("adAccountId", "imageHash");

-- CreateIndex
CREATE UNIQUE INDEX "Creative_organizationId_adAccountId_metaId_key" ON "Creative"("organizationId", "adAccountId", "metaId");

-- CreateIndex
CREATE INDEX "Page_organizationId_name_idx" ON "Page"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Page_organizationId_metaId_key" ON "Page"("organizationId", "metaId");

-- CreateIndex
CREATE INDEX "InstagramAccount_organizationId_username_idx" ON "InstagramAccount"("organizationId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramAccount_organizationId_metaId_key" ON "InstagramAccount"("organizationId", "metaId");

-- CreateIndex
CREATE INDEX "Pixel_organizationId_name_idx" ON "Pixel"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Pixel_organizationId_metaId_key" ON "Pixel"("organizationId", "metaId");

-- CreateIndex
CREATE INDEX "CustomAudience_organizationId_name_idx" ON "CustomAudience"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CustomAudience_organizationId_metaId_key" ON "CustomAudience"("organizationId", "metaId");

-- CreateIndex
CREATE INDEX "Insight_adAccountId_level_dateStart_dateStop_idx" ON "Insight"("adAccountId", "level", "dateStart", "dateStop");

-- CreateIndex
CREATE INDEX "Insight_adAccountId_entityMetaId_dateStart_idx" ON "Insight"("adAccountId", "entityMetaId", "dateStart");

-- CreateIndex
CREATE INDEX "Insight_organizationId_syncedAt_idx" ON "Insight"("organizationId", "syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Insight_organizationId_adAccountId_level_entityMetaId_dateS_key" ON "Insight"("organizationId", "adAccountId", "level", "entityMetaId", "dateStart", "dateStop", "timeIncrement", "breakdownHash", "attributionHash");

-- CreateIndex
CREATE INDEX "SavedView_userId_adAccountId_level_idx" ON "SavedView"("userId", "adAccountId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "SavedView_organizationId_userId_adAccountId_level_name_key" ON "SavedView"("organizationId", "userId", "adAccountId", "level", "name");

-- CreateIndex
CREATE INDEX "Draft_organizationId_userId_status_idx" ON "Draft"("organizationId", "userId", "status");

-- CreateIndex
CREATE INDEX "Draft_adAccountId_updatedAt_idx" ON "Draft"("adAccountId", "updatedAt");

-- CreateIndex
CREATE INDEX "SyncJob_organizationId_status_createdAt_idx" ON "SyncJob"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SyncJob_queueName_status_idx" ON "SyncJob"("queueName", "status");

-- CreateIndex
CREATE INDEX "SyncJob_requestId_idx" ON "SyncJob"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncJob_organizationId_idempotencyKey_key" ON "SyncJob"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Operation_adAccountId_status_createdAt_idx" ON "Operation"("adAccountId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Operation_requestId_idx" ON "Operation"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "Operation_organizationId_idempotencyKey_key" ON "Operation"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ReportPreset_adAccountId_idx" ON "ReportPreset"("adAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportPreset_organizationId_userId_name_key" ON "ReportPreset"("organizationId", "userId", "name");

-- CreateIndex
CREATE INDEX "ReportRun_organizationId_status_createdAt_idx" ON "ReportRun"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReportRun_adAccountId_queryHash_idx" ON "ReportRun"("adAccountId", "queryHash");

-- CreateIndex
CREATE INDEX "ReportRun_metaReportRunId_idx" ON "ReportRun"("metaReportRunId");

-- CreateIndex
CREATE UNIQUE INDEX "ExportFile_objectKey_key" ON "ExportFile"("objectKey");

-- CreateIndex
CREATE INDEX "ExportFile_organizationId_expiresAt_idx" ON "ExportFile"("organizationId", "expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_resourceId_idx" ON "AuditLog"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "ApiRequestLog_organizationId_createdAt_idx" ON "ApiRequestLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiRequestLog_operation_outcome_createdAt_idx" ON "ApiRequestLog"("operation", "outcome", "createdAt");

-- CreateIndex
CREATE INDEX "ApiRequestLog_requestId_idx" ON "ApiRequestLog"("requestId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthAccount" ADD CONSTRAINT "AuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthState" ADD CONSTRAINT "OAuthState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaConnection" ADD CONSTRAINT "MetaConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MetaConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncryptedToken" ADD CONSTRAINT "EncryptedToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncryptedToken" ADD CONSTRAINT "EncryptedToken_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MetaConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cursor" ADD CONSTRAINT "Cursor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cursor" ADD CONSTRAINT "Cursor_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MetaConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cursor" ADD CONSTRAINT "Cursor_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSet" ADD CONSTRAINT "AdSet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSet" ADD CONSTRAINT "AdSet_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSet" ADD CONSTRAINT "AdSet_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "AdSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creative" ADD CONSTRAINT "Creative_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creative" ADD CONSTRAINT "Creative_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramAccount" ADD CONSTRAINT "InstagramAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramAccount" ADD CONSTRAINT "InstagramAccount_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pixel" ADD CONSTRAINT "Pixel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pixel" ADD CONSTRAINT "Pixel_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomAudience" ADD CONSTRAINT "CustomAudience_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomAudience" ADD CONSTRAINT "CustomAudience_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MetaConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MetaConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportPreset" ADD CONSTRAINT "ReportPreset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportPreset" ADD CONSTRAINT "ReportPreset_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportPreset" ADD CONSTRAINT "ReportPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MetaConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "ReportPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportFile" ADD CONSTRAINT "ExportFile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportFile" ADD CONSTRAINT "ExportFile_reportRunId_fkey" FOREIGN KEY ("reportRunId") REFERENCES "ReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiRequestLog" ADD CONSTRAINT "ApiRequestLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
