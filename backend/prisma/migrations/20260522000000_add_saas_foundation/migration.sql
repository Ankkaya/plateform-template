-- SaaS platform identity, internal plans, tenant subscriptions, and lifecycle metadata.

CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'EXPIRED', 'CANCELED');
CREATE TYPE "PlatformOperationAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'OTHER');

ALTER TABLE "Tenant"
  ADD COLUMN "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "contactName" TEXT,
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "contactPhone" TEXT,
  ADD COLUMN "logoUrl" TEXT,
  ADD COLUMN "domain" TEXT,
  ADD COLUMN "remark" TEXT;

CREATE TABLE "PlatformUser" (
  "id" SERIAL NOT NULL,
  "username" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "name" TEXT,
  "email" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
  "permissions" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "PlatformUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaasPlan" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "priceCents" INTEGER NOT NULL DEFAULT 0,
  "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
  "userLimit" INTEGER,
  "storageLimitBytes" BIGINT,
  "featureFlags" JSONB NOT NULL DEFAULT '{}',
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "sort" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SaasPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantSubscription" (
  "id" SERIAL NOT NULL,
  "tenantId" INTEGER NOT NULL,
  "planId" INTEGER NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trialEndsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "userLimitOverride" INTEGER,
  "storageLimitBytesOverride" BIGINT,
  "remark" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "TenantSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformOperationLog" (
  "id" SERIAL NOT NULL,
  "platformUserId" INTEGER,
  "username" TEXT,
  "action" "PlatformOperationAction" NOT NULL,
  "module" TEXT,
  "targetId" TEXT,
  "description" TEXT,
  "requestBody" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformOperationLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformUser_username_key" ON "PlatformUser"("username");
CREATE UNIQUE INDEX "PlatformUser_email_key" ON "PlatformUser"("email");
CREATE INDEX "PlatformUser_deletedAt_idx" ON "PlatformUser"("deletedAt");
CREATE INDEX "PlatformUser_isEnabled_idx" ON "PlatformUser"("isEnabled");

CREATE UNIQUE INDEX "SaasPlan_code_key" ON "SaasPlan"("code");
CREATE INDEX "SaasPlan_deletedAt_idx" ON "SaasPlan"("deletedAt");
CREATE INDEX "SaasPlan_isEnabled_idx" ON "SaasPlan"("isEnabled");
CREATE INDEX "SaasPlan_sort_idx" ON "SaasPlan"("sort");

CREATE UNIQUE INDEX "TenantSubscription_tenantId_key" ON "TenantSubscription"("tenantId");
CREATE INDEX "TenantSubscription_planId_idx" ON "TenantSubscription"("planId");
CREATE INDEX "TenantSubscription_status_idx" ON "TenantSubscription"("status");
CREATE INDEX "TenantSubscription_expiresAt_idx" ON "TenantSubscription"("expiresAt");
CREATE INDEX "TenantSubscription_deletedAt_idx" ON "TenantSubscription"("deletedAt");

CREATE INDEX "PlatformOperationLog_platformUserId_idx" ON "PlatformOperationLog"("platformUserId");
CREATE INDEX "PlatformOperationLog_createdAt_idx" ON "PlatformOperationLog"("createdAt");
CREATE INDEX "PlatformOperationLog_module_idx" ON "PlatformOperationLog"("module");

CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "SaasPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformOperationLog" ADD CONSTRAINT "PlatformOperationLog_platformUserId_fkey"
  FOREIGN KEY ("platformUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
