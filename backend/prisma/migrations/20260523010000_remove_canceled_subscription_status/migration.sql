UPDATE "TenantSubscription"
SET "status" = 'EXPIRED'
WHERE "status" = 'CANCELED';

ALTER TABLE "TenantSubscription" ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "SubscriptionStatus" RENAME TO "SubscriptionStatus_old";

CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'EXPIRED');

ALTER TABLE "TenantSubscription"
  ALTER COLUMN "status" TYPE "SubscriptionStatus"
  USING "status"::text::"SubscriptionStatus";

ALTER TABLE "TenantSubscription"
  ALTER COLUMN "status" SET DEFAULT 'TRIALING';

DROP TYPE "SubscriptionStatus_old";

ALTER TABLE "TenantSubscription" DROP COLUMN "canceledAt";
