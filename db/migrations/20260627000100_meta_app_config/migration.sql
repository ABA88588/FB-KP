-- CreateTable
CREATE TABLE "MetaAppConfig" (
    "id" UUID NOT NULL,
    "metaAppId" TEXT NOT NULL,
    "encryptedMetaAppSecret" JSONB,
    "graphApiVersion" TEXT NOT NULL DEFAULT 'v25.0',
    "oauthRedirectUri" TEXT NOT NULL,
    "enableMetaWrites" BOOLEAN NOT NULL DEFAULT false,
    "emergencyReadOnly" BOOLEAN NOT NULL DEFAULT false,
    "allowedAdAccountIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID NOT NULL,
    "updatedByUserId" UUID,

    CONSTRAINT "MetaAppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaAppConfig_organizationId_key" ON "MetaAppConfig"("organizationId");

-- CreateIndex
CREATE INDEX "MetaAppConfig_updatedByUserId_idx" ON "MetaAppConfig"("updatedByUserId");

-- AddForeignKey
ALTER TABLE "MetaAppConfig" ADD CONSTRAINT "MetaAppConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAppConfig" ADD CONSTRAINT "MetaAppConfig_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
