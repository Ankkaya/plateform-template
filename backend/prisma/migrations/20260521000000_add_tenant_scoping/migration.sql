-- CreateTable
CREATE TABLE "Tenant" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- Seed the default tenant for existing single-tenant data.
INSERT INTO "Tenant" ("id", "name", "code", "isEnabled", "createdAt", "updatedAt")
VALUES (1, '默认租户', 'default', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

SELECT setval(pg_get_serial_sequence('"Tenant"', 'id'), GREATEST((SELECT MAX("id") FROM "Tenant"), 1));

-- AlterTable
ALTER TABLE "User" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "Role" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "Menu" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "SystemSetting" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "DictionaryType" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "DictionaryItem" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "OperationLog" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "LoginLog" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "UploadRecord" ADD COLUMN "tenantId" INTEGER;

UPDATE "User" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "Role" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "Menu" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "SystemSetting" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "DictionaryType" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "DictionaryItem" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "OperationLog" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "LoginLog" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "UploadRecord" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

ALTER TABLE "User" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Role" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Menu" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "SystemSetting" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "DictionaryType" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "DictionaryItem" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "OperationLog" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "LoginLog" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "UploadRecord" ALTER COLUMN "tenantId" SET NOT NULL;

-- DropIndex
DROP INDEX IF EXISTS "User_username_key";
DROP INDEX IF EXISTS "User_email_key";
DROP INDEX IF EXISTS "Role_name_key";
DROP INDEX IF EXISTS "Role_code_key";
DROP INDEX IF EXISTS "SystemSetting_key_key";
DROP INDEX IF EXISTS "DictionaryType_code_key";

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_code_key" ON "Tenant"("code");
CREATE INDEX "Tenant_deletedAt_idx" ON "Tenant"("deletedAt");
CREATE INDEX "Tenant_isEnabled_idx" ON "Tenant"("isEnabled");

CREATE UNIQUE INDEX "User_tenantId_username_key" ON "User"("tenantId", "username");
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

CREATE UNIQUE INDEX "Role_tenantId_name_key" ON "Role"("tenantId", "name");
CREATE UNIQUE INDEX "Role_tenantId_code_key" ON "Role"("tenantId", "code");
CREATE INDEX "Role_tenantId_idx" ON "Role"("tenantId");

CREATE INDEX "Menu_tenantId_idx" ON "Menu"("tenantId");

CREATE UNIQUE INDEX "SystemSetting_tenantId_key_key" ON "SystemSetting"("tenantId", "key");
CREATE INDEX "SystemSetting_tenantId_idx" ON "SystemSetting"("tenantId");

CREATE UNIQUE INDEX "DictionaryType_tenantId_code_key" ON "DictionaryType"("tenantId", "code");
CREATE INDEX "DictionaryType_tenantId_idx" ON "DictionaryType"("tenantId");
CREATE INDEX "DictionaryItem_tenantId_idx" ON "DictionaryItem"("tenantId");

CREATE INDEX "OperationLog_tenantId_idx" ON "OperationLog"("tenantId");
CREATE INDEX "LoginLog_tenantId_idx" ON "LoginLog"("tenantId");
CREATE INDEX "UploadRecord_tenantId_idx" ON "UploadRecord"("tenantId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DictionaryType" ADD CONSTRAINT "DictionaryType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DictionaryItem" ADD CONSTRAINT "DictionaryItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationLog" ADD CONSTRAINT "OperationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoginLog" ADD CONSTRAINT "LoginLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UploadRecord" ADD CONSTRAINT "UploadRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
