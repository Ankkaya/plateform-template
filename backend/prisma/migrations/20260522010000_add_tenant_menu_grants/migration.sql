-- Tenant menu grant ceiling controlled by platform operators.

ALTER TABLE "Menu"
  ADD COLUMN "isTenantGranted" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "Menu_isTenantGranted_idx" ON "Menu"("isTenantGranted");
