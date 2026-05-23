-- Move subscription duration and trial period from the per-tenant overrides into the plan definition.

ALTER TABLE "SaasPlan"
  ADD COLUMN "trialDays" INTEGER,
  ADD COLUMN "durationDays" INTEGER;

ALTER TABLE "TenantSubscription"
  DROP COLUMN "userLimitOverride",
  DROP COLUMN "storageLimitBytesOverride";
