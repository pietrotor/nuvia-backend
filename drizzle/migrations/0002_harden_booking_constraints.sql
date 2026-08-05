CREATE EXTENSION IF NOT EXISTS "btree_gist";--> statement-breakpoint

DROP INDEX IF EXISTS "business_configs_tenant_idx";--> statement-breakpoint

CREATE INDEX "appointments_client_idx"
ON "appointments" USING btree ("client_id");--> statement-breakpoint

CREATE INDEX "appointments_service_idx"
ON "appointments" USING btree ("service_id");--> statement-breakpoint

CREATE INDEX "professional_services_service_idx"
ON "professional_services" USING btree ("service_id");--> statement-breakpoint

ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_valid_time_range"
CHECK ("ends_at" > "starts_at");--> statement-breakpoint

ALTER TABLE "schedule_blocks"
ADD CONSTRAINT "schedule_blocks_valid_time_range"
CHECK ("ends_at" > "starts_at");--> statement-breakpoint

ALTER TABLE "services"
ADD CONSTRAINT "services_positive_duration"
CHECK ("duration_minutes" > 0);--> statement-breakpoint

ALTER TABLE "services"
ADD CONSTRAINT "services_non_negative_price"
CHECK ("price_bs" >= 0);--> statement-breakpoint

ALTER TABLE "services"
ADD CONSTRAINT "services_valid_deposit_percent"
CHECK ("deposit_percent" IS NULL OR "deposit_percent" BETWEEN 1 AND 100);--> statement-breakpoint

ALTER TABLE "services"
ADD CONSTRAINT "services_positive_deposit_amount"
CHECK ("deposit_amount_bs" IS NULL OR "deposit_amount_bs" > 0);--> statement-breakpoint

ALTER TABLE "services"
ADD CONSTRAINT "services_deposit_configuration"
CHECK (
  (
    "requires_deposit" = false
    AND "deposit_amount_bs" IS NULL
    AND "deposit_percent" IS NULL
  )
  OR
  (
    "requires_deposit" = true
    AND num_nonnulls("deposit_amount_bs", "deposit_percent") = 1
  )
);--> statement-breakpoint

ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_no_active_overlap"
EXCLUDE USING gist (
  "tenant_id" WITH =,
  "professional_id" WITH =,
  tstzrange("starts_at", "ends_at", '[)') WITH &&
)
WHERE ("status" IN ('pending_deposit', 'confirmed'));