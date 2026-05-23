UPDATE "TenantSubscription"
SET "status" = 'ACTIVE'
WHERE "status" = 'TRIALING';

ALTER TABLE "TenantSubscription" ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "SubscriptionStatus" RENAME TO "SubscriptionStatus_old";

CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELED');

ALTER TABLE "TenantSubscription"
  ALTER COLUMN "status" TYPE "SubscriptionStatus"
  USING (
    CASE
      WHEN "status"::text = 'TRIALING' THEN 'ACTIVE'
      ELSE "status"::text
    END
  )::"SubscriptionStatus";

ALTER TABLE "TenantSubscription"
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

DROP TYPE "SubscriptionStatus_old";

UPDATE "SaasPlan"
SET "durationDays" = 365
WHERE "durationDays" IS NULL;

ALTER TABLE "SaasPlan" ALTER COLUMN "durationDays" SET DEFAULT 365;
ALTER TABLE "SaasPlan" ALTER COLUMN "durationDays" SET NOT NULL;
ALTER TABLE "SaasPlan" DROP COLUMN "trialDays";

UPDATE "TenantSubscription" AS subscription
SET "expiresAt" = subscription."startsAt" + (plan."durationDays" * INTERVAL '1 day')
FROM "SaasPlan" AS plan
WHERE subscription."planId" = plan."id"
  AND subscription."expiresAt" IS NULL;

ALTER TABLE "TenantSubscription" DROP COLUMN "trialEndsAt";
ALTER TABLE "TenantSubscription" DROP COLUMN "remark";
ALTER TABLE "TenantSubscription" ADD COLUMN "canceledAt" TIMESTAMP(3);
