CREATE TABLE "deposit_qrs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "label" varchar(100) NOT NULL,
  "storage_key" text NOT NULL,
  "mime_type" varchar(100) NOT NULL,
  "size_bytes" integer NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "deposit_qrs_positive_size" CHECK ("size_bytes" > 0)
);--> statement-breakpoint

ALTER TABLE "deposit_qrs" ADD CONSTRAINT "deposit_qrs_tenant_id_tenants_id_fk"
FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade;--> statement-breakpoint

CREATE INDEX "deposit_qrs_tenant_idx" ON "deposit_qrs" ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_qrs_default_uq"
ON "deposit_qrs" ("tenant_id")
WHERE "is_default" AND "is_active";--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_qrs_label_uq"
ON "deposit_qrs" ("tenant_id", "label")
WHERE "is_active";--> statement-breakpoint

ALTER TABLE "services" ADD COLUMN "deposit_qr_id" uuid;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_deposit_qr_id_deposit_qrs_id_fk"
FOREIGN KEY ("deposit_qr_id") REFERENCES "public"."deposit_qrs"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_deposit_qr_requires_deposit"
CHECK ("deposit_qr_id" IS NULL OR "requires_deposit" = true);--> statement-breakpoint

ALTER TABLE "business_configs" DROP COLUMN "static_deposit_qr_url";
